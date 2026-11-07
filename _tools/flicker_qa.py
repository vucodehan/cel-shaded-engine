"""Shimmer / z-fighting check: python flicker_qa.py <film> | <video.mp4> [--from S] [--to S] [--maps N] [--thresh T]

Finds picture areas that flicker frame to frame: a pixel whose value jumps away from BOTH neighbouring frames while
those two agree (|x[t]-x[t-1]| > T, |x[t+1]-x[t]| > T, opposite signs, |x[t+1]-x[t-1]| small). Camera moves (ones),
characters on twos, hard cuts, grain reseeded on twos and slow glows never do that; z-fighting surfaces, popping
outlines, crawling thin lines and shadow acne do. Spikes are counted per pixel in 1-second windows on a 480 px wide
grey copy; a window fails when its spikes form a connected patch (a shimmering trim, panel or edge), not scattered
noise. Each failing window is reported with its scene and scene-local frames (from timing.json) and a heat map
(out/qa/flicker-<t>.jpg: the frame with the flickering pixels in red) so the shot can be found and fixed.

    python flicker_qa.py "[102]example-film"        the film's parts if present, else its narrated master
    python flicker_qa.py video.mp4 --from 110 --to 140                any video, a time range
Exit code 1 when any window fails. pipeline.py runs it on every freshly rendered part (section 11 of CelshadedSKILL.md).
"""
import argparse
import json
import subprocess
import sys
from pathlib import Path

import numpy as np
from scipy import ndimage

sys.path.insert(0, str(Path(__file__).resolve().parent))
from films import film_dir  # noqa: E402

FPS = 30
W = 320
THRESH = 22          # grey levels (of 255) a pixel must differ from every explanation of it
MIN_PATCH = 7        # px (at 320 wide, ~0.04 % of the frame) of connected flicker in one window to fail it
MIN_COUNT = 3        # flicker frames per pixel per window for a pixel to count as flickering
SEARCH = 3           # motion search radius in px at 320 wide (~10 px per frame at 1080p)
BLOCK = 8


def probe(video):
    out = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height,nb_frames,r_frame_rate",
                          "-of", "json", str(video)], capture_output=True, text=True, check=True).stdout
    s = json.loads(out)["streams"][0]
    num, den = s["r_frame_rate"].split("/")
    return int(s["width"]), int(s["height"]), int(s.get("nb_frames") or 0), float(num) / float(den)


def frames(video, w, h, start=0.0, dur=None):
    """Yield grey frames (h, w) uint8 at the source rate."""
    cmd = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-nostdin"]
    if start:
        cmd += ["-ss", f"{start:.3f}"]
    cmd += ["-i", str(video)]
    if dur:
        cmd += ["-t", f"{dur:.3f}"]
    cmd += ["-vf", f"scale={w}:{h}:flags=area,format=gray", "-f", "rawvideo", "-pix_fmt", "gray", "-"]
    p = subprocess.Popen(cmd, stdout=subprocess.PIPE)
    n = w * h
    while True:
        buf = p.stdout.read(n)
        if len(buf) < n:
            break
        yield np.frombuffer(buf, np.uint8).reshape(h, w)
    p.wait()


def unexplained(a, b, c):
    """|b - its best explanation| per pixel for consecutive frames a, b, c (float32, sides multiples of BLOCK).

    Per 8 px block, b may be explained as a displaced copy of a or of c (a held pose on twos while the camera moves
    on ones, a cut, a pan) or as the midpoint of a and c moving symmetrically (a coastline sweeping past in a zoom, a
    fast hand): whichever candidate fits the block best predicts its pixels. A surface that toggles (z-fighting), a
    strobing shake, an outline popping on and off or a sub-pixel sparkle has no such explanation."""
    R, B = SEARCH, BLOCK
    h, w = b.shape
    hb, wb = h // B, w // B
    pa, pc = np.pad(a, R, mode="edge"), np.pad(c, R, mode="edge")
    best = np.full((hb, wb), np.inf, np.float32)
    pred = b.copy()
    bsad = lambda X: np.abs(X - b).reshape(hb, B, wb, B).sum(axis=(1, 3))
    for dy in range(-R, R + 1):
        for dx in range(-R, R + 1):
            A = pa[R + dy:R + dy + h, R + dx:R + dx + w]
            C = pc[R + dy:R + dy + h, R + dx:R + dx + w]
            Cm = pc[R - dy:R - dy + h, R - dx:R - dx + w]
            for X in (A, C, (A + Cm) * 0.5):
                sad = bsad(X)
                m = sad < best
                if m.any():
                    best[m] = sad[m]
                    px = np.repeat(np.repeat(m, B, 0), B, 1)
                    pred[px] = X[px]
    return np.abs(b - pred)


def scan(video, start=0.0, end=None, thresh=THRESH):
    """[(window_start_frame, patch_px, spike_px, count_map)] for every 1 s window of the video range."""
    vw, vh, _, fps = probe(video)
    h = max(BLOCK, int(round(W * vh / vw / BLOCK)) * BLOCK)
    w = W if vw >= vh else max(BLOCK, int(round(W * vw / vh / BLOCK)) * BLOCK)
    if vw < vh:
        h = W
    out, win, prev2, prev1, t = [], None, None, None, 0
    first = int(round(start * fps))
    for fr in frames(video, w, h, start, None if end is None else end - start):
        x = fr.astype(np.float32)
        if prev2 is not None:
            # only frames where some pixel differs from both neighbours need the motion search (holds on twos do not)
            cand = (np.abs(prev1 - prev2) > thresh) & (np.abs(prev1 - x) > thresh)
            spike = (unexplained(prev2, prev1, x) > thresh) if cand.sum() >= MIN_PATCH else np.zeros(x.shape, bool)
            k = (t - 1) // FPS
            if win is None or win[0] != k:
                if win is not None:
                    out.append(close(win, first))
                win = [k, np.zeros(x.shape, np.int16), prev1.astype(np.uint8)]
            win[1] += spike
            if (t - 1) % FPS == FPS // 2:
                win[2] = prev1.astype(np.uint8)
        prev2, prev1, t = prev1, x, t + 1
    if win is not None:
        out.append(close(win, first))
    return out, fps


def close(win, first):
    k, counts, mid = win
    hot = counts >= MIN_COUNT
    lab, n = ndimage.label(hot, structure=np.ones((3, 3)))
    patch = int(np.bincount(lab.ravel())[1:].max()) if n else 0
    return {"frame": first + k * FPS, "patch": patch, "spikes": int(hot.sum()), "counts": counts, "mid": mid}


def heat(win, path):
    from PIL import Image
    g = win["mid"].astype(np.float32)
    rgb = np.stack([g, g, g], -1) * 0.75
    c = np.clip(win["counts"] / 8.0, 0, 1)
    rgb[..., 0] = np.maximum(rgb[..., 0], c * 255)
    rgb[..., 1] *= 1 - c * 0.8
    rgb[..., 2] *= 1 - c * 0.8
    Image.fromarray(rgb.astype(np.uint8)).resize((960, int(960 * g.shape[0] / g.shape[1])), Image.NEAREST).save(path, quality=90)


def scene_at(timing, frame):
    s0 = 0
    for sc in timing["scenes"]:
        if frame < s0 + sc["duration"] - timing["overlap"] // 2:
            return sc["id"], frame - s0
        s0 += sc["duration"] - timing["overlap"]
    return timing["scenes"][-1]["id"], frame - s0


def load_accept(root):
    """<film>/qa.json {"accept": {"<scene>": [[from, to, "why"], ...]}}: scene-local frame ranges whose flicker is
    intended motion (a particle stream, travellers on a path, sparks), reviewed in the heat maps and signed off."""
    p = Path(root) / "qa.json"
    return json.loads(p.read_text(encoding="utf-8")).get("accept", {}) if p.exists() else {}


def check_video(video, timing=None, offset=0, start=0.0, end=None, maps=8, qa_dir=None, label="", thresh=THRESH, accept=None):
    """(rows, windows): rows = (video frame, patch px, flickering px, "scene a-b", accepted reason or None)."""
    wins, fps = scan(video, start, end, thresh)
    bad = [w for w in wins if w["patch"] >= MIN_PATCH]
    rows = []
    for w in bad:
        f = offset + w["frame"]
        where, why = "", None
        if timing:
            sid, local = scene_at(timing, f)
            where = f"{sid} {local}-{local + FPS}"
            for a, b, reason in (accept or {}).get(sid, []):
                if local < b and local + FPS > a:
                    why = reason
        rows.append((w["frame"], w["patch"], w["spikes"], where, why))
    if qa_dir:
        qa_dir.mkdir(parents=True, exist_ok=True)
        flagged = [w for w, r in zip(bad, rows) if r[4] is None]
        for w in sorted(flagged, key=lambda w: -w["patch"])[:maps]:
            sid = scene_at(timing, offset + w["frame"]) if timing else None
            name = f"flicker-{sid[0]}-{sid[1]:04d}.jpg" if sid else f"flicker-{label}{w['frame']:06d}.jpg"
            heat(w, qa_dir / name)
    return rows, len(wins)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("target")
    ap.add_argument("--from", dest="start", type=float, default=0.0)
    ap.add_argument("--to", dest="end", type=float)
    ap.add_argument("--maps", type=int, default=8)
    ap.add_argument("--thresh", type=float, default=THRESH)
    a = ap.parse_args()
    target = Path(a.target)
    total_bad = 0
    if target.suffix.lower() == ".mp4":
        rows, n = check_video(target, start=a.start, end=a.end, maps=a.maps, qa_dir=target.parent / "qa", thresh=a.thresh)
        total_bad = report(str(target), rows, n)
    else:
        total_bad = check_film(a.target, a.start, a.end, a.maps, a.thresh)
    sys.exit(1 if total_bad else 0)


def check_film(folder, start=0.0, end=None, maps=8, thresh=THRESH, parts=None):
    """Check the film's rendered parts (both orientations; `parts` = part numbers to check, default all on disk),
    else its narrated master. Returns the number of flickering windows not in qa.json's accept list."""
    import parts as P
    root = film_dir(folder)
    timing = json.loads((root / "src" / "timing.json").read_text(encoding="utf-8"))
    accept = load_accept(root)
    qa = root / "out" / "qa"
    _, rngs, _ = P.load(root)
    videos = [(P.part_path(root, folder, r["n"], o), r["a"], f"p{r['n']}-{o}-") for r in rngs for o in P.ORIENTS if parts is None or r["n"] in parts]
    videos = [v for v in videos if v[0].exists()]
    if not videos:
        m = next(iter(sorted((root / "out").glob("*youtube-narrated.mp4"))), None) or next(iter(sorted((root / "out").glob("*-master.mp4"))), None)
        if not m:
            raise SystemExit("no parts and no narrated master to check")
        videos = [(m, 0, "")]
    from concurrent.futures import ProcessPoolExecutor
    bad = 0
    with ProcessPoolExecutor(max_workers=min(8, len(videos))) as ex:
        futs = [ex.submit(check_video, v, timing, off, start, end, maps, qa, lab, thresh, accept) for v, off, lab in videos]
        for (v, _, _), fu in zip(videos, futs):
            rows, n = fu.result()
            bad += report(v.name, rows, n)
    return bad


def report(name, rows, n):
    """Print the windows; returns how many are not accepted."""
    flagged = [r for r in rows if r[4] is None]
    print(f"{name}: {n} one-second windows, {len(flagged)} flickering" + (f", {len(rows) - len(flagged)} accepted" if len(rows) > len(flagged) else "") + (":" if rows else " (clean)"))
    for fr, patch, spikes, where, why in rows:
        print(f"  {fr / FPS:7.1f}s  frame {fr:6d}  patch {patch:4d} px  flickering {spikes:5d} px  {where}" + (f"  (accepted: {why})" if why else ""))
    return len(flagged)


if __name__ == "__main__":
    main()
