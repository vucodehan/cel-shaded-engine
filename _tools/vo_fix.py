"""Voice fixes for delivered films: python vo_fix.py <folder> [<folder> ...]

1. Re-trims every take from its cached ElevenLabs audio with narrate.trim, which cuts breaths and clicks after the
   last word. No TTS calls. The start of each take never moves, so cue frames, word timings, and the picture stay.
   lines.json / cues.json get the new durations; cues.json "frames" keeps the planned slot the picture was timed to.
2. Rebuilds the two narrated MP4s with the dry voice (pipeline.narrated) and regenerates the subtitles.
The Resolve projects are moved to the A4 voice track separately: python resolve_drp.py a4 <folder>.
Needs the masters: run out/rebuildvideo.bat (without clean) first and cleanup.py afterwards.
"""
import json
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import narrate  # noqa: E402
import pipeline  # noqa: E402

from films import film_dir, take  # noqa: E402
TOOLS = Path(__file__).resolve().parent


def retrim(folder: str):
    root = film_dir(folder)
    lp, cp = root / "narration" / "lines.json", root / "narration" / "cues.json"
    lines = json.loads(lp.read_text(encoding="utf-8"))
    cues = json.loads(cp.read_text(encoding="utf-8"))
    changed = []
    for ln in lines:
        cache = root / "narration" / "cache" / ln["hash"]
        a, lo = narrate.trim(narrate.read_wav(cache.with_suffix(".wav")))
        wav = take(root, ln)
        old = len(narrate.read_wav(wav))
        if len(a) == old:
            continue
        dur = len(a) / narrate.SR
        meta = json.loads(cache.with_suffix(".json").read_text(encoding="utf-8"))
        narrate.write_wav(wav, a)
        ln["dur"] = round(dur, 3)
        ln["words"] = narrate.words_from(meta.get("alignment"), lo / narrate.SR, dur)
        changed.append((ln["i"], round((old - len(a)) / narrate.SR, 3)))
    by = {ln["i"]: ln for ln in lines}
    for c in cues["clips"]:
        c["dur"], c["words"] = by[c["i"]]["dur"], by[c["i"]]["words"]
    lp.write_text(json.dumps(lines, indent=2, ensure_ascii=False), encoding="utf-8")
    cp.write_text(json.dumps(cues, indent=1, ensure_ascii=False), encoding="utf-8")
    return changed


def main(folders):
    for folder in folders:
        changed = retrim(folder)
        print(f"{folder}: {len(changed)} takes re-trimmed " + ", ".join(f"{i:02d} (-{s:.2f}s)" for i, s in changed), flush=True)
        pipeline.narrated(folder)
        subprocess.run([sys.executable, str(TOOLS / "srt.py"), folder], check=True)


if __name__ == "__main__":
    main(sys.argv[1:])
