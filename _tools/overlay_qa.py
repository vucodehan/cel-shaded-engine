"""Overlay flash check: find frames where a text overlay reappears after it ended (a frozen layer from one render tab).

    python overlay_qa.py <film>                 check the film's render parts (chapter-card windows + the whole frame)
    python overlay_qa.py video.mp4 --box x,y,w,h [--from N --count M]   check any video region

A flash frame differs from the frame before and the frame after while those two agree (a cut or animation on twos
never does that). Chapter cards end at scene frame 84; the window after it (frames 86-420) must be clean, and since
films mix in motion-design scenes (DOM/SVG, src/mo) every part is also scanned at the whole frame. pipeline.py runs
this on every freshly rendered part and re-renders a part that fails, once.
"""
import argparse
import json
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import parts as P  # noqa: E402
from films import film_dir  # noqa: E402

CARD_END = 84
WINDOW = (CARD_END + 2, 420)
BOX = {"16x9": (40, 600, 1100, 300), "9x16": (20, 1040, 1040, 300)}


def _frames(video, box, start, count, fps=30, w=48, h=16):
    cmd = ["ffmpeg", "-hide_banner", "-loglevel", "error"]
    if start:
        cmd += ["-ss", f"{start / fps:.4f}"]
    cmd += ["-i", str(video)]
    if count:
        cmd += ["-frames:v", str(count)]
    vf = f"scale={w}:{h}:flags=area" if box is None else f"crop={box[2]}:{box[3]}:{box[0]}:{box[1]},scale={w}:{h}:flags=area"
    cmd += ["-vf", vf, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]
    data = subprocess.run(cmd, capture_output=True, check=True).stdout
    n = w * h * 3
    return [data[i:i + n] for i in range(0, len(data) - n + 1, n)]


def _dist(a, b):
    return sum(abs(p - q) for p, q in zip(a, b)) / len(a)


def flashes(video, box, start=0, count=None, thresh=6.0, size=(48, 16)):
    """Frame indices (relative to the video) of flash frames in the box (None = whole frame), within [start, start + count)."""
    fr = _frames(video, box, start, count, w=size[0], h=size[1])
    out = []
    for i in range(1, len(fr) - 1):
        d0, d1, dn = _dist(fr[i], fr[i - 1]), _dist(fr[i], fr[i + 1]), _dist(fr[i - 1], fr[i + 1])
        if min(d0, d1) > thresh and dn < min(d0, d1) * 0.5:
            out.append(start + i)
    return out


def chapter_windows(t, a, b):
    """(first, count) windows in part-local frames after each chapter card that falls inside film frames [a, b)."""
    st, s = [], 0
    for sc in t["scenes"]:
        st.append(s)
        s += sc["duration"] - t["overlap"]
    wins = []
    for sc, s0 in zip(t["scenes"], st):
        if not sc.get("virtue"):
            continue
        lo, hi = max(a, s0 + WINDOW[0]), min(b, s0 + WINDOW[1], s0 + sc["duration"])
        if hi - lo > 3:
            wins.append((lo - a, hi - lo))
    return wins


def check_part(root, folder, t, r, orient):
    """Chapter-card windows (the card's own box), then the whole part at the whole frame: motion-design scenes
    (src/mo) are DOM and SVG, which can freeze in a busy tab like the old DOM chapter card did."""
    video = P.part_path(root, folder, r["n"], orient)
    bad = []
    for first, count in chapter_windows(t, r["a"], r["b"]):
        bad += flashes(video, BOX[orient], first, count)
    bad += flashes(video, None, size=(64, 36) if orient == "16x9" else (36, 64))
    return sorted(set(bad))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("target")
    ap.add_argument("--box")
    ap.add_argument("--from", dest="start", type=int, default=0)
    ap.add_argument("--count", type=int)
    a = ap.parse_args()
    if a.box:
        bad = flashes(a.target, [int(v) for v in a.box.split(",")], a.start, a.count)
        print(f"{a.target}: {len(bad)} flash frames" + (": " + ", ".join(map(str, bad)) if bad else ""))
        sys.exit(1 if bad else 0)
    root = film_dir(a.target)
    t = json.loads((root / "src" / "timing.json").read_text(encoding="utf-8"))
    _, rngs, _ = P.load(root)
    total = 0
    for r in rngs:
        for orient in P.ORIENTS:
            if not P.part_path(root, a.target, r["n"], orient).exists():
                print(f"  part {r['n']} {orient}: no part file")
                continue
            bad = check_part(root, a.target, t, r, orient)
            total += len(bad)
            print(f"  part {r['n']} {orient}: " + (f"{len(bad)} flash frames (part-local {bad[:12]})" if bad else "clean"))
    sys.exit(1 if total else 0)


if __name__ == "__main__":
    main()
