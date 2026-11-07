"""2x frame interpolation on the GPU (RIFE): python interp.py <film> [--model=rife-v4.6] [--chunk=1200] [--only=16x9|9x16]

Makes out/<f>-youtube-narrated-60fps.mp4 and out/<f>-vertical-narrated-60fps.mp4 from the 30 fps films: every
frame pair gets an in-between from RIFE (rife-ncnn-vulkan in _tools/bin/rife: Vulkan, so any recent NVIDIA or AMD GPU,
RTX 3090 included; no Python packages). The picture comes from the 40 Mbit/s narrated master when it still exists
(pipeline.py --interp runs this before the clean-up), else from the delivered file; the audio is the delivered file's
(already at -14 LUFS), copied.

Hard cuts stay hard: cuts are found from frame differences and the in-between frame across a cut repeats the last
frame of the outgoing shot instead of blending two shots. Characters animated on twos keep their held poses (the
in-between of two identical frames is that frame); camera moves and the twos' pose changes get the new frames.
Frames go through in chunks with a one-frame overlap, so the temporary JPEGs stay at a few GB.
"""
import shutil
import subprocess
import sys
import time
from pathlib import Path

from films import CFG, STATE, TOOLS, film_dir

RIFE = TOOLS / "bin" / "rife" / "rife-ncnn-vulkan.exe"


def enc_args(bitrate: str):
    """NVENC at a fixed average bitrate (config.json deliver.interp_bitrate, 20M since round 5: about 1.1 GB for a
    7-minute film instead of 1.9 GB at constant quality 19, with no visible loss at 1080p60)."""
    mbit = float(bitrate.rstrip("Mm"))
    # -bf 0: B-frames pulse thin bright lines between sharp and soft (export.py _nvenc_h264)
    return ["-c:v", "h264_nvenc", "-preset", "p5", "-tune", "hq", "-rc", "vbr", "-b:v", f"{mbit:g}M", "-maxrate", f"{mbit * 1.25:g}M",
            "-bufsize", f"{mbit * 2:g}M", "-bf", "0", "-profile:v", "high", "-pix_fmt", "yuv420p", "-colorspace", "bt709", "-color_primaries", "bt709",
            "-color_trc", "bt709", "-g", "120"]


ENC = enc_args(str(CFG["deliver"].get("interp_bitrate", "20M")))


def frames_of(video: Path) -> int:
    r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-count_packets", "-show_entries", "stream=nb_read_packets",
                        "-of", "csv=p=0", str(video)], capture_output=True, text=True)
    return int(r.stdout.strip() or 0)


def cuts_of(video: Path, w=64, h=36):
    """Indices c where a hard cut falls between frame c and c+1."""
    data = subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-i", str(video), "-vf", f"scale={w}:{h}:flags=area,format=gray",
                           "-f", "rawvideo", "-"], capture_output=True, check=True).stdout
    n = w * h
    fr = [data[i:i + n] for i in range(0, len(data) - n + 1, n)]
    d = [0.0] + [sum(abs(p - q) for p, q in zip(fr[i], fr[i - 1])) / n for i in range(1, len(fr))]
    out = []
    for i in range(1, len(d)):
        nb = max(d[i - 1], d[i + 1] if i + 1 < len(d) else 0.0)
        if d[i] > 14 and d[i] > 3 * max(nb, 0.8):
            out.append(i - 1)
    return out


def interpolate(src: Path, audio: Path, dst: Path, tmp: Path, model: str, chunk: int):
    t0 = time.time()
    n = frames_of(src)
    cuts = set(cuts_of(src))
    print(f"  {src.name}: {n} frames, {len(cuts)} cuts", flush=True)
    shutil.rmtree(tmp, ignore_errors=True)
    (tmp / "all").mkdir(parents=True)
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-i", str(src), "-q:v", "2", "-start_number", "0", str(tmp / "all" / "%08d.jpg")], check=True)
    video = tmp / "video.mp4"
    enc = subprocess.Popen(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-f", "image2pipe", "-framerate", "60", "-c:v", "mjpeg", "-i", "-",
                            *ENC, str(video)], stdin=subprocess.PIPE)
    written = 0
    s = 0
    while s < n:
        last = s + chunk >= n - 1
        e = n - 1 if last else s + chunk          # inclusive: the next chunk's first frame closes the last gap
        keep = 2 * (n - s) if last else 2 * (e - s)
        cin, cout = tmp / "in", tmp / "out"
        for d in (cin, cout):
            shutil.rmtree(d, ignore_errors=True)
            d.mkdir()
        for k in range(s, e + 1):
            shutil.copyfile(tmp / "all" / f"{k:08d}.jpg", cin / f"{k - s + 1:08d}.jpg")
        r = subprocess.run([str(RIFE), "-i", str(cin), "-o", str(cout), "-m", str(RIFE.parent / model), "-f", "jpg", "-g", "0", "-j", "2:4:4"],
                           capture_output=True, text=True)
        outs = sorted(cout.glob("*.jpg"))
        if r.returncode or len(outs) < keep:
            enc.kill()
            raise SystemExit(f"RIFE failed on frames {s}-{e} (exit {r.returncode}, {len(outs)} of {keep} frames):\n{r.stderr[-800:]}")
        outs = outs[:keep]
        for c in cuts:
            if s <= c < s + keep // 2:
                outs[2 * (c - s) + 1] = outs[2 * (c - s)]
        for p in outs:
            enc.stdin.write(p.read_bytes())
        written += len(outs)
        for k in range(s, e):
            (tmp / "all" / f"{k:08d}.jpg").unlink(missing_ok=True)
        print(f"    frames {s}-{e}: {written}/{2 * n} written, {time.time() - t0:.0f}s", flush=True)
        s = e if not last else n
    enc.stdin.close()
    if enc.wait():
        raise SystemExit("the encoder failed")
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(video), "-i", str(audio), "-map", "0:v:0", "-map", "1:a:0",
                    "-c", "copy", "-shortest", "-movflags", "+faststart", str(dst)], check=True)
    got = frames_of(dst)
    shutil.rmtree(tmp, ignore_errors=True)
    if abs(got - 2 * n) > 1:
        raise SystemExit(f"{dst.name}: {got} frames, expected {2 * n}")
    print(f"  {dst.name}: {got} frames at 60 fps in {time.time() - t0:.0f}s", flush=True)


def main(folder: str, args: list):
    opt = {a.split("=")[0]: (a.split("=", 1)[1] if "=" in a else True) for a in args}
    model = str(opt.get("--model", "rife-v4.6"))
    chunk = int(opt.get("--chunk", 1200))
    if not RIFE.exists():
        raise SystemExit(f"missing {RIFE} (rife-ncnn-vulkan release zip, unpacked to _tools/bin/rife)")
    out = film_dir(folder) / "out"
    jobs = {"16x9": (f"{folder}-master-narrated.mp4", f"{folder}-youtube-narrated.mp4", f"{folder}-youtube-narrated-60fps.mp4"),
            "9x16": (f"{folder}-vertical-master-narrated.mp4", f"{folder}-vertical-narrated.mp4", f"{folder}-vertical-narrated-60fps.mp4")}
    for orient, (master, deliv, dst) in jobs.items():
        if "--only" in opt and opt["--only"] != orient:
            continue
        audio = out / deliv
        if not audio.exists():
            raise SystemExit(f"missing {audio.name}: deliver the film first")
        src = out / master if (out / master).exists() else audio
        print(f"{folder} {orient}: interpolating {src.name} -> {dst}", flush=True)
        interpolate(src, audio, out / dst, STATE / "interp" / f"{orient}", model, chunk)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2:])
