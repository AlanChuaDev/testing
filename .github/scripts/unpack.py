#!/usr/bin/env python3
"""
Unpack the newest *.zip in the repo root over the previously deployed game files.

Features:

- Only files previously deployed (listed in .deployed-manifest.txt) are deleted
  during a full deployment.
- Patch mode: files are added or overwritten without deleting old files.
- Automatically strips a single wrapper folder containing index.html.
- Ignores .github/ and *.zip inside the archive.
- Synchronizes with the latest remote main branch before pushing.
- Automatically retries non-fast-forward push failures.
- Does not force-push or overwrite remote commits.
  """

import glob
import os
import shutil
import subprocess
import sys
import tempfile
import time
import zipfile

MANIFEST = ".deployed-manifest.txt"
MAX_PUSH_RETRIES = 5

--------------------------------------------------

Git helpers

--------------------------------------------------

def git(*args, check=True):
result = subprocess.run(
["git", *args],
capture_output=True,
text=True
)

if check and result.returncode != 0:
    print("Git command failed:", " ".join(args))
    print(result.stdout)
    print(result.stderr)
    sys.exit(result.returncode)

return result

def git_output(*args):
return git(*args).stdout.strip()

def current_branch():
branch = os.environ.get("GITHUB_REF_NAME")

if branch:
    return branch

branch = git_output(
    "branch",
    "--show-current"
)

return branch or "main"

--------------------------------------------------

Find ZIP

--------------------------------------------------

zips = sorted(
glob.glob("*.zip"),
key=lambda p: (
subprocess.run(
[
"git",
"log",
"-1",
"--format=%ct",
"--",
p
],
capture_output=True,
text=True
).stdout.strip() or "0",
p
)
)

if not zips:
print("No ZIP found, nothing to do.")
sys.exit(0)

z = zips[-1]

print("Unpacking:", z)

PATCH = z.lower().endswith("-patch.zip")

if PATCH:
print("Patch mode enabled: only add or overwrite files.")
else:
print("Full deployment mode enabled.")

--------------------------------------------------

Extract ZIP safely

--------------------------------------------------

tmp = tempfile.mkdtemp()

try:
with zipfile.ZipFile(z) as zf:

    for n in zf.namelist():

        normalized = n.replace("\\", "/")

        if (
            os.path.isabs(n)
            or ".." in normalized.split("/")
        ):
            sys.exit(
                "Unsafe path in ZIP: " + n
            )

    zf.extractall(tmp)

# Remove junk files
for root, dirs, files in os.walk(tmp):

    for d in list(dirs):

        if d in ("__MACOSX", ".DS_Store"):

            shutil.rmtree(
                os.path.join(root, d)
            )

            dirs.remove(d)

    for f in files:

        if f == ".DS_Store":

            os.remove(
                os.path.join(root, f)
            )

# --------------------------------------------------
# Find folder containing index.html
# --------------------------------------------------

src = tmp
entries = os.listdir(src)

while (
    len(entries) == 1
    and os.path.isdir(
        os.path.join(src, entries[0])
    )
    and not os.path.exists(
        os.path.join(src, "index.html")
    )
):

    src = os.path.join(
        src,
        entries[0]
    )

    entries = os.listdir(src)

if not os.path.exists(
    os.path.join(src, "index.html")
):

    sys.exit(
        "index.html not found in ZIP. "
        "Expected at top level or inside one folder."
    )

# --------------------------------------------------
# Remove previous deployment files
# Only in full deployment mode
# --------------------------------------------------

if (
    os.path.exists(MANIFEST)
    and not PATCH
):

    with open(
        MANIFEST,
        encoding="utf-8"
    ) as mf:

        previous_files = mf.read().splitlines()

    for line in previous_files:

        line = line.strip()

        if (
            line
            and not line.startswith(".github")
            and os.path.isfile(line)
        ):

            os.remove(line)

    # Clean empty directories
    for root, dirs, files in os.walk(
        ".",
        topdown=False
    ):

        if (
            root.startswith("./.git")
            or root.startswith("./.github")
            or root == "."
        ):
            continue

        if not os.listdir(root):
            os.rmdir(root)

# --------------------------------------------------
# Copy new files
# --------------------------------------------------

new = []

for root, dirs, files in os.walk(src):

    for f in files:

        full = os.path.join(root, f)

        rel = os.path.relpath(
            full,
            src
        ).replace(os.sep, "/")

        if (
            rel.startswith(".github/")
            or rel.lower().endswith(".zip")
            or rel == MANIFEST
        ):
            continue

        os.makedirs(
            os.path.dirname(rel) or ".",
            exist_ok=True
        )

        shutil.copy2(
            full,
            rel
        )

        new.append(rel)

# --------------------------------------------------
# Update manifest
# --------------------------------------------------

if (
    PATCH
    and os.path.exists(MANIFEST)
):

    with open(
        MANIFEST,
        encoding="utf-8"
    ) as mf:

        previous = [
            line.strip()
            for line in mf.read().splitlines()
            if line.strip()
        ]

    new = sorted(
        set(new) | set(previous)
    )

else:

    new = sorted(
        set(new)
    )

with open(
    MANIFEST,
    "w",
    encoding="utf-8"
) as mf:

    mf.write(
        "\n".join(new) + "\n"
    )

# --------------------------------------------------
# Remove uploaded ZIP
# --------------------------------------------------

for p in zips:

    if os.path.exists(p):
        os.remove(p)

print(
    "Deployment prepared:",
    len(new),
    "files"
)

finally:

shutil.rmtree(
    tmp,
    ignore_errors=True
)

--------------------------------------------------

Commit changes

--------------------------------------------------

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

git(
"add",
"-A"
)

commit_result = git(
"diff",
"--cached",
"--quiet",
check=False
)

if commit_result.returncode == 0:

print(
    "No file changes detected. "
    "Nothing to commit."
)

sys.exit(0)

git(
"commit",
"-m",
"自动解压 zip 并更新游戏文件 [skip ci]"
)

--------------------------------------------------

Synchronize with remote and push safely

--------------------------------------------------

branch = current_branch()

print(
"Synchronizing with remote branch:",
branch
)

for attempt in range(
1,
MAX_PUSH_RETRIES + 1
):

print(
    f"Push attempt {attempt}/{MAX_PUSH_RETRIES}"
)

# Fetch latest remote commits
git(
    "fetch",
    "origin",
    branch
)

# Rebase our commit on top of the newest remote branch.
# This avoids the non-fast-forward rejection.
rebase_result = git(
    "rebase",
    f"origin/{branch}",
    check=False
)

if rebase_result.returncode != 0:

    print(
        "Rebase failed. "
        "A remote change conflicts with this deployment."
    )

    git(
        "rebase",
        "--abort",
        check=False
    )

    sys.exit(
        "Deployment stopped safely. "
        "No force push was performed."
    )

# Push
push_result = git(
    "push",
    "origin",
    f"HEAD:{branch}",
    check=False
)

if push_result.returncode == 0:

    print(
        "Push successful."
    )

    sys.exit(0)

print(
    "Push rejected. "
    "The remote branch may have changed again."
)

print(
    push_result.stderr
)

# Retry only if the remote branch advanced.
if attempt < MAX_PUSH_RETRIES:

    time.sleep(
        attempt * 2
    )

print(
"Push failed after all retries."
)

sys.exit(1)
