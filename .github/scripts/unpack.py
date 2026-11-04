
#!/usr/bin/env python3
"""Unpack ZIP files and safely update the GitHub repository."""

import glob
import os
import shutil
import subprocess
import sys
import tempfile
import time
import zipfile

MANIFEST = ".deployed-manifest.txt"
MAX_RETRIES = 5


# --------------------------------------------------
# Git helpers
# --------------------------------------------------

def git(*args, check=True):
    result = subprocess.run(
        ["git"] + list(args),
        capture_output=True,
        text=True
    )

    if check and result.returncode != 0:
        print("Git error:", " ".join(args))
        print(result.stdout)
        print(result.stderr)
        sys.exit(result.returncode)

    return result


# --------------------------------------------------
# Find uploaded ZIP
# --------------------------------------------------

zips = sorted(glob.glob("*.zip"))

if not zips:
    print("No ZIP found.")
    sys.exit(0)

zip_file = zips[-1]

print("Using ZIP:", zip_file)

PATCH = zip_file.lower().endswith("-patch.zip")

if PATCH:
    print("Patch mode: keeping existing files.")
else:
    print("Full deployment mode.")


# --------------------------------------------------
# Extract ZIP safely
# --------------------------------------------------

tmp = tempfile.mkdtemp()

try:
    with zipfile.ZipFile(zip_file) as archive:

        for name in archive.namelist():

            normalized = name.replace("\\", "/")

            if (
                os.path.isabs(name)
                or ".." in normalized.split("/")
            ):
                sys.exit("Unsafe ZIP path: " + name)

        archive.extractall(tmp)

    # Remove unnecessary files
    for root, dirs, files in os.walk(tmp):

        for directory in list(dirs):

            if directory == "__MACOSX":

                shutil.rmtree(
                    os.path.join(root, directory)
                )

                dirs.remove(directory)

        for filename in files:

            if filename == ".DS_Store":

                os.remove(
                    os.path.join(root, filename)
                )

    # Find the directory containing index.html
    src = tmp

    while True:

        entries = os.listdir(src)

        if (
            len(entries) == 1
            and os.path.isdir(
                os.path.join(src, entries[0])
            )
            and not os.path.exists(
                os.path.join(src, "index.html")
            )
        ):

            src = os.path.join(src, entries[0])

        else:
            break

    if not os.path.exists(
        os.path.join(src, "index.html")
    ):

        sys.exit(
            "index.html not found in ZIP."
        )

    # --------------------------------------------------
    # Remove previous deployed files in full mode
    # --------------------------------------------------

    if (
        not PATCH
        and os.path.exists(MANIFEST)
    ):

        with open(
            MANIFEST,
            encoding="utf-8"
        ) as manifest_file:

            old_files = manifest_file.read().splitlines()

        for filename in old_files:

            filename = filename.strip()

            if (
                filename
                and not filename.startswith(".github/")
                and os.path.isfile(filename)
            ):

                os.remove(filename)

        # Remove empty directories
        for root, dirs, files in os.walk(
            ".",
            topdown=False
        ):

            if (
                root == "."
                or root.startswith("./.git")
                or root.startswith("./.github")
            ):
                continue

            if not os.listdir(root):
                os.rmdir(root)

    # --------------------------------------------------
    # Copy files from ZIP
    # --------------------------------------------------

    new_files = []

    for root, dirs, files in os.walk(src):

        for filename in files:

            full_path = os.path.join(
                root,
                filename
            )

            relative_path = os.path.relpath(
                full_path,
                src
            ).replace(os.sep, "/")

            if (
                relative_path.startswith(".github/")
                or relative_path.lower().endswith(".zip")
                or relative_path == MANIFEST
            ):
                continue

            os.makedirs(
                os.path.dirname(relative_path) or ".",
                exist_ok=True
            )

            shutil.copy2(
                full_path,
                relative_path
            )

            new_files.append(relative_path)

    # --------------------------------------------------
    # Update deployment manifest
    # --------------------------------------------------

    if (
        PATCH
        and os.path.exists(MANIFEST)
    ):

        with open(
            MANIFEST,
            encoding="utf-8"
        ) as manifest_file:

            previous_files = [
                line.strip()
                for line in manifest_file.read().splitlines()
                if line.strip()
            ]

        new_files = sorted(
            set(new_files) | set(previous_files)
        )

    else:

        new_files = sorted(
            set(new_files)
        )

    with open(
        MANIFEST,
        "w",
        encoding="utf-8"
    ) as manifest_file:

        manifest_file.write(
            "\n".join(new_files) + "\n"
        )

    # Delete uploaded ZIP after extraction
    for uploaded_zip in zips:

        if os.path.exists(uploaded_zip):
            os.remove(uploaded_zip)

    print(
        "Prepared",
        len(new_files),
        "files."
    )

finally:

    shutil.rmtree(
        tmp,
        ignore_errors=True
    )


# --------------------------------------------------
# Configure Git identity
# --------------------------------------------------

git(
    "config",
    "user.name",
    "github-actions[bot]"
)

git(
    "config",
    "user.email",
    "41898282+github-actions[bot]@users.noreply.github.com"
)


# --------------------------------------------------
# Create commit
# --------------------------------------------------

git("add", "-A")

changes = git(
    "diff",
    "--cached",
    "--quiet",
    check=False
)

if changes.returncode == 0:

    print("No changes to commit.")

    sys.exit(0)

git(
    "commit",
    "-m",
    "自动解压 ZIP 并更新游戏文件 [skip ci]"
)


# --------------------------------------------------
# Synchronize with GitHub and push
# --------------------------------------------------

branch = os.environ.get(
    "GITHUB_REF_NAME",
    "main"
)

print("Target branch:", branch)

for attempt in range(1, MAX_RETRIES + 1):

    print(
        "Push attempt",
        attempt,
        "of",
        MAX_RETRIES
    )

    # Get latest remote commits
    git(
        "fetch",
        "origin",
        branch
    )

    # Rebase local commit on top of latest remote
    rebase = git(
        "rebase",
        "origin/" + branch,
        check=False
    )

    if rebase.returncode != 0:

        print("Rebase conflict detected.")

        git(
            "rebase",
            "--abort",
            check=False
        )

        sys.exit(
            "Stopped safely. "
            "Remote changes conflict with this update."
        )

    # Push without force
    push = git(
        "push",
        "origin",
        "HEAD:" + branch,
        check=False
    )

    if push.returncode == 0:

        print("Push successful.")

        sys.exit(0)

    print("Push rejected. Retrying.")

    print(push.stderr)

    if attempt < MAX_RETRIES:

        time.sleep(attempt * 2)


print("Push failed after all retries.")

sys.exit(1)
