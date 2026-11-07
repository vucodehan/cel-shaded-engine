"""Create or refresh a cel film folder from the kit (_kit).

python scaffold.py 102 the-sermon-on-the-mount        create "[102]the-sermon-on-the-mount" in the workspace
python scaffold.py "[102]the-sermon-on-the-mount"      refresh an existing film: missing files, node_modules, remotion.config.ts
python scaffold.py "[102]..." --engine                 also overwrite the engine (src/cel, src/mg, CelFilm, Lab, KitLab, scripts)
python scaffold.py "[102]..." --svgkit                 also copy the house SVG motion-graphics kit to src/svgkit

A new film gets its story number in the folder name from the start, so every file the pipeline writes carries it.
The film's own files are never overwritten: src/script.json, src/timing.json, src/scenes/* (common.ts included,
it holds the film's sets and presets), BRIEF.md, parts.json. Without --engine an existing film keeps its engine
(film 101 keeps its frozen copy). node_modules is a directory junction to _kit/node_modules, the workspace's one
Remotion 4.0.531 + three install; a junction pointing anywhere else is replaced.
"""
import json
import os
import re
import shutil
import subprocess
import sys

from films import KIT, NODE, film_dir

ENGINE_DIRS = ("src/cel", "src/mg", "src/mo", "src/promo")
ENGINE_FILES = ("src/CelFilm.tsx", "src/Lab.tsx", "src/KitLab.tsx", "src/MapLab.tsx", "src/HandLab.tsx", "src/MoLab.tsx")
NEW_ONLY = ("src/Root.tsx", "src/index.ts", "src/scenes/common.ts", "src/scenes/placeholder.tsx", "tsconfig.json", "public/grain.png")
ALWAYS = ("remotion.config.ts",)


def junction(root):
    """Point root/node_modules at _kit/node_modules. Returns True when the link was (re)made."""
    nm = root / "node_modules"
    if os.path.lexists(nm):
        if nm.exists() and os.path.samefile(nm, NODE):
            return False
        try:
            # os.rmdir removes a junction (even a broken one) itself, never the files it points at; shutil.rmtree
            # would follow the link and empty the shared install.
            os.rmdir(nm)
        except OSError:
            raise SystemExit(f"{nm} is a real folder, not a junction: move it away, then run this again")
    subprocess.run(["cmd", "/c", "mklink", "/J", str(nm), str(NODE)], check=True, capture_output=True)
    return True


def scenes_index(root):
    idx = root / "src" / "scenes" / "index.ts"
    if idx.exists() or idx.with_suffix(".tsx").exists():
        return
    script = root / "src" / "script.json"
    ids = [s["id"] for s in json.loads(script.read_text(encoding="utf-8-sig"))["scenes"]] if script.exists() else ["title", "end"]
    body = ",\n".join(f'  {i}: (p) => <Placeholder {{...p}} id="{i}" />' for i in ids)
    idx.with_suffix(".tsx").write_text(
        'import React from "react";\nimport { SceneProps } from "../CelFilm";\nimport { Placeholder } from "./placeholder";\n\n'
        "// One entry per scene id in script.json; replace each Placeholder with the scene's own component.\n"
        f"export const VISUALS: Record<string, React.FC<SceneProps>> = {{\n{body},\n}};\n", encoding="utf-8")


def main(folder, engine=False, svgkit=False):
    root = film_dir(folder)
    new = not (root / "src").exists()
    for d in ("src/scenes", "scripts", "public", "narration", "out"):
        (root / d).mkdir(parents=True, exist_ok=True)
    copied = []
    for d in ENGINE_DIRS:
        if not (KIT / d).exists():
            continue
        if new or engine or not (root / d).exists():
            if (root / d).exists():
                shutil.rmtree(root / d)
            shutil.copytree(KIT / d, root / d)
            copied.append(d)
    for rel in ENGINE_FILES + ALWAYS:
        if new or engine or rel in ALWAYS or not (root / rel).exists():
            shutil.copy2(KIT / rel, root / rel)
            copied.append(rel)
    for rel in NEW_ONLY:
        if not (root / rel).exists():
            shutil.copy2(KIT / rel, root / rel)
            copied.append(rel)
    for p in (KIT / "scripts").iterdir():
        if p.is_file() and (engine or not (root / "scripts" / p.name).exists()):
            shutil.copy2(p, root / "scripts" / p.name)
            copied.append(f"scripts/{p.name}")
    if svgkit:
        if (root / "src" / "svgkit").exists():
            shutil.rmtree(root / "src" / "svgkit")
        shutil.copytree(KIT / "svgkit", root / "src" / "svgkit")
        copied.append("src/svgkit")
    if (KIT / "public" / "fonts").exists() and (new or engine or not (root / "public" / "fonts").exists()):
        if (root / "public" / "fonts").exists():
            shutil.rmtree(root / "public" / "fonts")
        shutil.copytree(KIT / "public" / "fonts", root / "public" / "fonts")
        copied.append("public/fonts")
    if (KIT / "src" / "timing.json").exists() and not (root / "src" / "timing.json").exists():
        shutil.copy2(KIT / "src" / "timing.json", root / "src" / "timing.json")
        copied.append("src/timing.json")
    if not (root / "BRIEF.md").exists():
        shutil.copy2(KIT / ("BRIEF-promo.md" if root.name.startswith("[promo-") else "BRIEF-template.md"), root / "BRIEF.md")
        copied.append("BRIEF.md")
    scenes_index(root)
    pkg = json.loads((KIT / "package.json").read_text(encoding="utf-8"))
    pkg["name"] = re.sub(r"[^a-z0-9-]", "", folder.lower().replace("[", "").replace("]", "-")) or "cel-film"
    pkg["description"] = f"{folder}: cel-shaded narrated film (16:9 and 9:16)"
    pkg["scripts"] = {"studio": "remotion studio", "score": "python scripts/score.py", "stills": "node scripts/celstills.mjs"}
    (root / "package.json").write_text(json.dumps(pkg, indent=2) + "\n", encoding="utf-8")
    shutil.copy2(KIT / "package-lock.json", root / "package-lock.json")
    linked = junction(root)
    print(f"{'created' if new else 'refreshed'} {root}: {len(copied)} items copied" + (", node_modules linked to _kit" if linked else ""))


if __name__ == "__main__":
    flags = {a for a in sys.argv[1:] if a.startswith("--")}
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    # A story number ("102") or an episode code ("ep-001") names the folder.
    code = len(args) == 2 and re.fullmatch(r"\d+|[a-z]+-\d+", args[0])
    folder = f"[{int(args[0]) if args[0].isdigit() else args[0]}]{args[1]}" if code else args[0]
    if not re.match(r"^\[([\d-]+|[a-z]+-\d+)\]", folder) and not (film_dir(folder) / "src").is_dir() and "--unnumbered" not in flags:
        raise SystemExit(f"{folder}: a new film needs its story number or episode code, e.g. python scaffold.py 102 {folder}")
    main(folder, "--engine" in flags, "--svgkit" in flags)
