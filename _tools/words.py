"""Where narrated words fall, for syncing picture and sfx: python words.py <folder> word [word ...]

Prints scene, group, the frame offset from the group's start (use as gN+offset), and the scene-local frame.
Matching is case-insensitive on the word stripped of punctuation; a trailing * matches a prefix.
"""
import json
import re
import sys
from pathlib import Path

from films import film_dir


def norm(w: str) -> str:
    return re.sub(r"[^\w'-]", "", w.lower().replace("’", "'"))


def main(folder: str, targets: list[str]):
    root = film_dir(folder)
    cues = json.loads((root / "narration" / "cues.json").read_text(encoding="utf-8"))
    timing = json.loads((root / "src" / "timing.json").read_text(encoding="utf-8"))
    fps = timing["fps"]
    at = {(s["id"], k): g["at"] for s in timing["scenes"] for k, g in enumerate(s["groups"])}
    for clip in cues["clips"]:
        for w in clip.get("words", []):
            n = norm(w["w"])
            for t in targets:
                t = t.lower()
                if (t.endswith("*") and n.startswith(t[:-1])) or n == t:
                    off = round(w["s"] * fps)
                    g = at.get((clip["scene"], clip["group"]), 0)
                    print(f"{clip['scene']:<12} g{clip['group']}+{off:<4} local {g + off:<5} {w['w']}")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main(sys.argv[1], sys.argv[2:])
