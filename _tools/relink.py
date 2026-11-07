"""Repair Resolve projects whose media no longer resolves after a film folder was renamed or moved:
python relink.py [--check] [<folder> ...]      (no folders: every film folder in the workspace that holds a .drp)

Per .drp in a film folder (the project is named like the file) it opens Resolve's copy of the project (importing
the .drp if Resolve does not have it) and checks that every media pool clip's file exists. A missing file is looked
for in the film folder it came from (the folder named in its old path, under its plain or numbered name, wherever
it lives now; else the project's own folder): the same path below that folder, the same file name with or without
the folder's "[N]" prefix, then the same name anywhere in the folder. Found files replace the clip's media
(ReplaceClip); the project is saved and the .drp re-exported, then the new .drp is test-imported to confirm every
clip is online. Projects with nothing missing are left untouched. --check only reports.
Resolve must be open and no other script may be driving it.
"""
import os
import re
import sys
from pathlib import Path

import resolve_drp as R

WS = R.WS
NUM = re.compile(r"^\[([\d-]+|[a-z]+-\d+)\]")
FOLDERS = {}
for _d in WS.iterdir():
    if _d.is_dir():
        FOLDERS.setdefault(_d.name, _d)
        FOLDERS.setdefault(NUM.sub("", _d.name), _d)


def origin(old: str, root: Path) -> Path:
    """The film folder an old media path belonged to (it may since have been numbered or moved), else `root`."""
    for part in reversed(Path(old).parts[:-1]):
        if part in FOLDERS and (FOLDERS[part] / "src").is_dir() or part in FOLDERS and any(FOLDERS[part].glob("*.drp")):
            return FOLDERS[part]
    return root


def locate(old: str, root: Path):
    """Where a missing file lives now, or None."""
    p = Path(old)
    root = origin(old, root)
    m = NUM.match(root.name)
    prefix = m.group(0) if m else ""
    bare = root.name[len(prefix):]
    names = {p.name, p.name[len(prefix):] if prefix and p.name.startswith(prefix) else f"{prefix}{p.name}"}
    parts = list(p.parts)
    for key in (root.name, bare):
        if key in parts:
            rel = Path(*parts[parts.index(key) + 1 :]) if parts.index(key) + 1 < len(parts) else None
            if rel:
                for nm in names:
                    cand = root / rel.parent / nm
                    if cand.exists():
                        return cand
    hits = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in ("node_modules", ".git")]
        hits += [Path(dirpath) / f for f in filenames if f in names]
    if len(hits) > 1:
        tail = [x.lower() for x in parts[-3:-1]]
        hits.sort(key=lambda h: -sum(t in [x.lower() for x in h.parts] for t in tail))
    return hits[0] if hits else None


def offline(proj):
    clips = [c for c in proj.GetMediaPool().GetRootFolder().GetClipList() or [] if c.GetClipProperty("File Path")]
    return clips, [c for c in clips if not os.path.exists(c.GetClipProperty("File Path"))]


def drp_offline(pm, drp: Path, back: str) -> int:
    """Import the .drp under a scratch name and count its offline clips (what a user opening the file would see)."""
    tmp = "_relink_check"
    pm.DeleteProject(tmp)
    if not pm.ImportProject(str(drp), tmp):
        return -1
    proj = pm.LoadProject(tmp)
    n = len(offline(proj)[1]) if proj else -1
    pm.LoadProject(back)
    pm.DeleteProject(tmp)
    return n


def main(args):
    check = "--check" in args
    folders = [a for a in args if a != "--check"]
    roots = [WS / f for f in folders] if folders else sorted(d for d in WS.iterdir() if d.is_dir() and any(d.glob("*.drp")))
    pm = R.connect().GetProjectManager()
    neutral = pm.GetCurrentProject()
    neutral = neutral.GetName() if neutral and neutral.GetName() != "Untitled Project" else None
    broken_total = fixed_total = 0
    for root in roots:
        for drp in sorted(root.glob("*.drp")):
            name = drp.stem
            imported = False
            if name not in (pm.GetProjectListInCurrentFolder() or []):
                if check:
                    print(f"{root.name} | {name}: not in Resolve")
                    broken_total += 1
                    continue
                imported = bool(pm.ImportProject(str(drp), name))
            proj = pm.LoadProject(name)
            if not proj:
                print(f"{root.name} | {name}: COULD NOT OPEN")
                continue
            clips, missing = offline(proj)
            if not missing and not imported:
                print(f"{root.name} | {name}: ok ({len(clips)} clips)")
                continue
            broken_total += 1
            if check:
                print(f"{root.name} | {name}: Resolve missing {len(missing)} of {len(clips)}")
                continue
            fixed, lost = 0, []
            for c in missing:
                old = c.GetClipProperty("File Path")
                new = locate(old, root)
                if new and c.ReplaceClip(str(new)):
                    fixed += 1
                else:
                    lost.append(old)
            pm.SaveProject()
            tmp = drp.with_name(drp.stem + ".relink.drp")
            exported = bool(pm.ExportProject(name, str(tmp), False)) and tmp.exists()
            if exported:
                tmp.replace(drp)
            left = drp_offline(pm, drp, name) if exported else -1
            fixed_total += not lost and left == 0
            print(f"{root.name} | {name}: relinked {fixed}/{len(missing)}" + (" (imported from .drp)" if imported else "")
                  + f", .drp re-exported {exported}, offline in .drp {left}" + (f", NOT FOUND {[Path(x).name for x in lost[:6]]}" if lost else ""))
            for x in lost:
                print(f"    not found: {x}")
    if neutral:
        pm.LoadProject(neutral)
    print(f"--- projects needing repair: {broken_total}" + ("" if check else f", repaired cleanly: {fixed_total}"))


if __name__ == "__main__":
    main(sys.argv[1:])
