#!/usr/bin/env python3
"""Unpack the newest *.zip in the repo root over the previously deployed game files.
- Only files that a previous unpack created (listed in .deployed-manifest.txt) are deleted, so
  your README, LICENSE, .github etc. are never touched.
- A single wrapper folder inside the zip (e.g. game/) is stripped automatically.
- .github/ and *.zip inside the archive are ignored.
"""
import glob, os, shutil, subprocess, sys, tempfile, zipfile

MANIFEST = '.deployed-manifest.txt'
zips = sorted(glob.glob('*.zip'), key=lambda p: (subprocess.run(['git', 'log', '-1', '--format=%ct', '--', p], capture_output=True, text=True).stdout.strip() or '0', p))
if not zips:
    print('no zip found, nothing to do'); sys.exit(0)
z = zips[-1]; print('unpacking', z)

tmp = tempfile.mkdtemp()
with zipfile.ZipFile(z) as zf:
    for n in zf.namelist():                       # zip-slip guard
        if os.path.isabs(n) or '..' in n.split('/'):
            sys.exit('unsafe path in zip: ' + n)
    zf.extractall(tmp)
for junk in ('__MACOSX', '.DS_Store'):
    for root, dirs, files in os.walk(tmp):
        for d in list(dirs):
            if d == junk: shutil.rmtree(os.path.join(root, d)); dirs.remove(d)
        for f in files:
            if f == junk: os.remove(os.path.join(root, f))

# find the folder that holds index.html (strip wrapper folders)
src = tmp
entries = [e for e in os.listdir(src)]
while len(entries) == 1 and os.path.isdir(os.path.join(src, entries[0])) and not os.path.exists(os.path.join(src, 'index.html')):
    src = os.path.join(src, entries[0]); entries = os.listdir(src)
if not os.path.exists(os.path.join(src, 'index.html')):
    sys.exit('index.html not found in the zip (expected at top level or inside one folder)')

# remove files from the previous deployment
if os.path.exists(MANIFEST):
    for line in open(MANIFEST, encoding='utf-8').read().splitlines():
        line = line.strip()
        if line and not line.startswith('.github') and os.path.isfile(line):
            os.remove(line)
    # clean empty dirs
    for root, dirs, files in os.walk('.', topdown=False):
        if root.startswith(('./.git', './.github')) or root == '.': continue
        if not os.listdir(root): os.rmdir(root)

new = []
for root, dirs, files in os.walk(src):
    for f in files:
        full = os.path.join(root, f); rel = os.path.relpath(full, src).replace(os.sep, '/')
        if rel.startswith('.github/') or rel.lower().endswith('.zip') or rel == MANIFEST: continue
        os.makedirs(os.path.dirname(rel) or '.', exist_ok=True); shutil.copy2(full, rel); new.append(rel)
open(MANIFEST, 'w', encoding='utf-8').write('\n'.join(sorted(new)) + '\n')
for p in zips: os.remove(p)
print('deployed', len(new), 'files')
