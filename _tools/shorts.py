"""YouTube Shorts, one per render part: python shorts.py <film> [<film> ...]

Shorts must stay under 3 minutes; the render parts (parts.py) already are 40-178 s and start on a scene cut, so
part k becomes out/<film>-short-<k>-of-<N>.mp4: cut from the narrated vertical master at the part's frames, faded
at its joins (0.25 s in after the first part, 0.4 s out before the last), NVENC-encoded, -14 LUFS / -1.5 dBTP, and
checked against the Shorts spec. Parts are encoded in parallel (config.json deliver.parallel). Shorts get no caption
files of their own (the delivery standard keeps two SRTs per film): a Short's captions are
<film>-vertical-master-narrated.en_US.srt shifted by its start_s in out/<film>-shorts.json.
"""
import glob
import json
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor

import parts as P
from films import CFG, FF, film_dir

# no B-frames, no temporal AQ: frame-to-frame quality swings make thin bright lines pulse (export.py _nvenc_h264)
NVENC = ["-c:v", "h264_nvenc", "-preset", "p7", "-tune", "hq", "-rc", "vbr", "-cq", "24", "-b:v", "0", "-spatial_aq", "1",
         "-temporal_aq", "0", "-rc-lookahead", "32", "-bf", "0", "-profile:v", "high", "-pix_fmt", "yuv420p",
         "-bsf:v", "h264_metadata=colour_primaries=1:transfer_characteristics=1:matrix_coefficients=1"]


def encode(src, out, name, i, n, t0, length):
    vf, af = [], []
    if i:
        vf.append("fade=t=in:st=0:d=0.25")
        af.append("afade=t=in:st=0:d=0.25")
    if i < n - 1:
        vf.append(f"fade=t=out:st={length - 0.4:.3f}:d=0.4")
        af.append(f"afade=t=out:st={length - 0.6:.3f}:d=0.6")
    tmp = out / f"_short{i + 1}.mp4"
    cmd = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-nostdin", "-y", "-ss", f"{t0:.3f}", "-i", str(src), "-t", f"{length:.3f}"]
    cmd += (["-vf", ",".join(vf)] if vf else []) + (["-af", ",".join(af)] if af else [])
    cmd += NVENC + ["-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-movflags", "+faststart", str(tmp)]
    subprocess.run(cmd, check=True)
    subprocess.run([sys.executable, str(FF / "loudness.py"), str(tmp), "-I", "-14", "--tp", "-1.5", "-o", str(out / f"{name}.mp4"), "--overwrite", "--json-brief"],
                   check=True, capture_output=True)
    tmp.unlink(missing_ok=True)
    chk = subprocess.run([sys.executable, str(FF / "check.py"), str(out / f"{name}.mp4"), "--platform", "shorts"], capture_output=True, text=True)
    return chk.returncode == 0


def main(folder: str):
    root = film_dir(folder)
    out = root / "out"
    t, rngs, _ = P.load(root)
    fps = t["fps"]
    src = next((p for p in (out / f"{folder}-vertical-master-narrated.mp4", out / f"{folder}-vertical-narrated.mp4") if p.exists()), None)
    if not src:
        raise SystemExit(f"{folder}: needs the narrated vertical film first (rebuildvideo.bat recreates it)")
    for old in out.glob(f"{glob.escape(folder)}-short-*"):
        old.unlink()
    n = len(rngs)
    jobs = [(f"{folder}-short-{i + 1}-of-{n}", i, r["a"] / fps, r["frames"] / fps, r) for i, r in enumerate(rngs)]
    with ThreadPoolExecutor(max_workers=max(1, CFG["deliver"]["parallel"])) as ex:
        oks = list(ex.map(lambda j: encode(src, out, j[0], j[1], n, j[2], j[3]), jobs))
    manifest = {"source": src.name, "captions": f"{folder}-vertical-master-narrated.en_US.srt (shift by start_s)", "limit_s": P.LIMIT, "parts": []}
    ids = [s["id"] for s in t["scenes"]]
    for (name, i, t0, length, r), ok in zip(jobs, oks):
        nxt = ids.index(r["scenes"][-1]) + 1
        ends = f"before {ids[nxt]}" if nxt < len(ids) else "end of film"
        manifest["parts"].append({"file": f"{name}.mp4", "part": r["n"], "scenes": r["scenes"], "start_s": round(t0, 3), "duration_s": round(length, 3),
                                  "ends_at": ends, "cut": "scene" if nxt < len(ids) else None, "check_ok": ok})
        print(f"{name}: {t0:7.1f}s +{length:6.1f}s  {r['scenes'][0]} .. {r['scenes'][-1]}  ends {ends}  check {'ok' if ok else 'FAIL'}", flush=True)
    (out / f"{folder}-shorts.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")


if __name__ == "__main__":
    for f in sys.argv[1:]:
        main(f)
