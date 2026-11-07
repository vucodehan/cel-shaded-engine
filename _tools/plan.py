"""Fit scene timing to the narration: python plan.py <folder>

script.json + narration/lines.json -> src/timing.json (scene durations, group start frames) and
narration/cues.json (absolute frame of every voice take, for the Resolve timeline and the narrated mix).
Each group's text starts at `at`; its voice starts VO_LAG frames later; the next group follows after `gap`.
"""
import json
import math
import sys
from pathlib import Path

from films import film_dir
FPS, OV, VO_LAG = 30, 18, 6


def main(folder: str):
    root = film_dir(folder)
    script = json.loads((root / "src" / "script.json").read_text(encoding="utf-8-sig"))
    lines = json.loads((root / "narration" / "lines.json").read_text(encoding="utf-8"))
    by = {(l["scene"], l["group"]): l for l in lines}
    scenes, cues, start = [], [], 0
    for s in script["scenes"]:
        kind = s.get("kind", "verse")
        at = s.get("lead", 40 if kind == "title" else 22)
        groups = []
        for gi, g in enumerate(s.get("groups", [])):
            ln = by.get((s["id"], gi))
            vf = math.ceil(ln["dur"] * FPS) if ln else int(g.get("frames", 60))
            vo = at + VO_LAG
            item = {"t": g["t"], "at": at, "vo": vo, "vf": vf}
            if kind == "title" or g.get("hidden"):
                item["hidden"] = True
            groups.append(item)
            if ln:
                cues.append({"i": ln["i"], "scene": s["id"], "group": gi, "frame": start + vo, "frames": vf, "dur": ln["dur"], "text": " ".join(g["t"].split()), "file": ln["file"], "words": ln["words"]})
            at = vo + vf + g.get("gap", s.get("gap", 20)) + g.get("pause", 0)
        if groups:
            last = groups[-1]
            need = last["vo"] + last["vf"] + s.get("tail", 34) + s.get("hold", 0) + OV
        else:
            need = 0
        dur = max(s.get("min", 150), need)
        sc = {k: v for k, v in s.items() if k not in ("groups", "lead", "gap", "tail", "hold", "min", "notes")}
        sc.update({"kind": kind, "duration": dur, "groups": groups})
        scenes.append(sc)
        start += dur - OV
    total = start + OV
    timing = {
        "fps": FPS,
        "width": 1920,
        "height": 1080,
        "overlap": OV,
        **{k: script[k] for k in ("label", "title", "titleV", "titleOf", "titleSize", "titleSizeV", "sub", "endTitle", "endTitleV", "next", "key", "book", "series", "endQuote", "endRef", "burnCaptions", "project") if k in script},
        "scenes": scenes,
    }
    (root / "src" / "timing.json").write_text(json.dumps(timing, indent=1, ensure_ascii=False), encoding="utf-8")
    (root / "narration" / "cues.json").write_text(json.dumps({"folder": folder, "frames": total, "seconds": round(total / FPS, 3), "clips": cues}, indent=1, ensure_ascii=False), encoding="utf-8")
    print(f"{folder}: {len(scenes)} scenes, {total} frames ({total / FPS:.1f}s), {len(cues)} voice cues")
    for sc in scenes:
        print(f"  {sc['id']:<14} {sc['duration']:5d}f  " + "  ".join(str(g["at"]) for g in sc["groups"]))


if __name__ == "__main__":
    main(sys.argv[1])
