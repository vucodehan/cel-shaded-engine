"""Render and deliver one film: python pipeline.py <film> [options]

1. Parts (parts.py): the film split at scene cuts into parts of 40-178 s. Only parts whose content hash changed are
   rendered, both orientations, several at once (render_parts.mjs: JPEG frames, NVENC encode; config.json "render").
   Then the overlay flash check (overlay_qa.py) after every chapter card; a failing part is re-rendered once. Then the
   flicker gate (flicker_qa.py): shimmer or z-fighting outside the film's qa.json accept list stops the run before
   delivery (heat maps in out/qa; --accept-flicker overrides).
2. Masters: the parts joined without re-encoding (frame count checked), plus the score:
   out/<f>-master.mp4 (16:9) and out/<f>-vertical-master.mp4 (9:16).
3. Delivery, independent encodes in parallel (config.json "deliver"): the two SRTs; the narrated mix (dry Flint over
   the score, music 18 dB down); the narrated masters (picture stream-copied); <f>-youtube-narrated.mp4 and
   <f>-vertical-narrated.mp4 on NVENC at -14 LUFS / -1.5 dBTP; one YouTube Short per 9:16 part (shorts.py); a platform
   check; contact sheets. No music-only versions.
4. 60 fps versions (interp.py, when config.json deliver.interp or --interp): youtube-narrated-60fps and
   vertical-narrated-60fps, every frame pair given a RIFE in-between on the GPU, from the narrated masters.
5. Clean-up (cleanup.py, the delivery standard): out/ keeps youtube-narrated, vertical-narrated, their 60 fps versions,
   the Shorts and the two SRTs; masters, narrated masters and render parts (unless deliver.keep_parts) are deleted,
   and out/rebuildvideo.bat is written to bring them back.
Phase timings go to _state/runlog.json.

Options:
  --parts=2,3       render only these parts (still only when stale, unless --force)
  --force           re-render the selected parts even when their hash matches
  --render-only     stop after the masters (no delivery, no clean-up)
  --no-render       join the existing parts and deliver (refuses stale parts unless --allow-stale)
  --narrated-only   remake the narrated files and Shorts from the existing masters
  --keep-masters    skip the clean-up (for resolve_drp.py, vo_fix.py or edits; run cleanup.py afterwards)
  --interp          make the 60 fps versions even when config.json deliver.interp is off
  --accept-flicker  deliver even when the flicker gate finds flickering seconds (they are still reported)
  --parallel=N --tabs=N   override config.json for this run (--serial = --parallel=1)
"""
import json
import os
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import parts as P  # noqa: E402
import runlog  # noqa: E402
from films import CFG, FF, STATE, TOOLS, film_dir  # noqa: E402

PY = sys.executable


def show(cmd) -> str:
    return "> " + " ".join(str(c) for c in cmd)


def run(cmd, cwd):
    print(show(cmd), flush=True)
    subprocess.run([str(c) for c in cmd], cwd=cwd, check=True)


def chain(cmds, cwd) -> str:
    """Run commands one after another, capturing their output; raise with the log on the first failure."""
    log = []
    for cmd in cmds:
        r = subprocess.run([str(c) for c in cmd], cwd=cwd, capture_output=True, text=True, encoding="utf-8", errors="replace")
        log.append(show(cmd) + "\n" + (r.stdout + r.stderr).strip())
        if r.returncode:
            raise RuntimeError("\n".join(log) + f"\nexit code {r.returncode}")
    return "\n".join(log)


def parallel(chains, cwd, n=None):
    """Independent command chains, up to n at once (NVENC sessions); every log is printed when its chain ends."""
    n = n or CFG["deliver"]["parallel"]
    errors = []
    with ThreadPoolExecutor(max_workers=max(1, n)) as ex:
        futs = [ex.submit(chain, c, cwd) for c in chains]
        for f in futs:
            try:
                print(f.result(), flush=True)
            except RuntimeError as e:
                errors.append(str(e))
                print(str(e), flush=True)
    if errors:
        raise SystemExit(f"{len(errors)} delivery step(s) failed")


# ---- 1. parts -----------------------------------------------------------------------------------------------------

def render_parts(folder: str, only=None, force=False, par=None, tabs=None):
    root = film_dir(folder)
    t, rngs, fresh = P.load(root)
    hs = P.hashes(root, t, rngs)
    pdir = root / "out" / "parts"
    pdir.mkdir(parents=True, exist_ok=True)
    jobs, skipped = [], 0
    for r in rngs:
        for orient, comp in P.ORIENTS.items():
            out = P.part_path(root, folder, r["n"], orient)
            if (only and r["n"] not in only) or (not force and P.is_fresh(out, hs[(r["n"], orient)])):
                skipped += 1
                continue
            jobs.append({"id": f"part{r['n']}-{orient}", "comp": comp, "frameRange": [r["a"], r["b"] - 1], "out": str(out),
                         "n": r["n"], "orient": orient, "hash": hs[(r["n"], orient)], "scenes": r["scenes"]})
    print(f"{folder}: {len(rngs)} parts" + (" (new plan)" if fresh else "") + f", {len(jobs)} renders to do, {skipped} up to date or not selected", flush=True)
    for r in rngs:
        print(f"  part {r['n']}: {r['sec']:6.1f}s  frames {r['a']}-{r['b'] - 1}  {r['scenes'][0]} .. {r['scenes'][-1]}", flush=True)
    for old in pdir.glob("*-part*-*.mp4"):
        n = old.stem.rsplit("-part", 1)[-1].split("-")[0]
        if n.isdigit() and int(n) > len(rngs):
            old.unlink()
            old.with_suffix(".json").unlink(missing_ok=True)
    if not jobs:
        return t, rngs, hs
    render = {**CFG["render"]}
    if par:
        render["parallel"] = par
    if tabs:
        render["tabs"] = tabs
    spec_path = STATE / f"render-{os.getpid()}.json"
    spec_path.write_text(json.dumps({"root": str(root), "render": render, "jobs": jobs}, indent=1), encoding="utf-8")
    by_id = {j["id"]: j for j in jobs}
    print(f"rendering {len(jobs)} parts, {render['parallel']} at once x {render['tabs']} tabs, {render['image_format']} frames, {render['encoder']}", flush=True)
    runlog.mark(folder, "render-parts", "start")
    t0 = time.time()
    proc = subprocess.Popen(["node", str(TOOLS / "render_parts.mjs"), str(spec_path)], cwd=root, stdout=subprocess.PIPE,
                            stderr=subprocess.STDOUT, text=True, encoding="utf-8", errors="replace")
    failed = []
    for line in proc.stdout:
        line = line.strip()
        try:
            ev = json.loads(line)
        except ValueError:
            if line:
                print("  " + line, flush=True)
            continue
        kind, job = ev.get("event"), by_id.get(ev.get("job"))
        if kind == "progress":
            print(f"  {ev['t']} {ev['job']:14} {ev['progress'] * 100:5.1f}%  {ev['fps']} fps", flush=True)
        elif kind == "done" and job:
            side = {"hash": job["hash"], "frames": job["frameRange"][1] - job["frameRange"][0] + 1, "range": job["frameRange"],
                    "scenes": job["scenes"], "encoder": ev["encoder"], "sec": ev["sec"], "rendered": time.strftime("%Y-%m-%d %H:%M:%S")}
            Path(job["out"]).with_suffix(".json").write_text(json.dumps(side, indent=1), encoding="utf-8")
            print(f"  {ev['t']} {ev['job']:14} done in {ev['sec']}s ({ev['encoder']})", flush=True)
        elif kind == "failed":
            failed.append(ev["job"])
            print(f"  {ev['t']} {ev['job']:14} FAILED: {ev.get('error')}", flush=True)
        else:
            print(f"  {ev.get('t', '')} {kind}: " + json.dumps({k: v for k, v in ev.items() if k not in ('t', 'event')}), flush=True)
    proc.wait()
    spec_path.unlink(missing_ok=True)
    runlog.mark(folder, "render-parts", "end", note=f"{len(jobs) - len(failed)} rendered, {skipped} skipped, {time.time() - t0:.0f}s")
    if failed or proc.returncode:
        raise SystemExit(f"part renders failed: {', '.join(failed) or 'renderer exit ' + str(proc.returncode)}")
    return t, rngs, hs


def overlay_qa(folder: str, t, rngs, par=None, tabs=None):
    """Flash check after every chapter card (overlay_qa.py); a failing part is re-rendered once, then reported."""
    import overlay_qa as Q
    root = film_dir(folder)
    for attempt in (1, 2):
        bad = {}
        for r in rngs:
            for orient in P.ORIENTS:
                if P.part_path(root, folder, r["n"], orient).exists():
                    hits = Q.check_part(root, folder, t, r, orient)
                    if hits:
                        bad[(r["n"], orient)] = hits
        if not bad:
            print(f"overlay check: clean ({len(rngs) * len(P.ORIENTS)} parts)", flush=True)
            return
        for (n, orient), hits in bad.items():
            print(f"overlay check: part {n} {orient} has {len(hits)} flash frames (part-local {hits[:10]})", flush=True)
        if attempt == 2:
            runlog.mark(folder, "overlay-qa", "end", note=f"flashes remain in {sorted(bad)}")
            print("WARNING overlay flashes remain after a re-render: inspect those frames before publishing", flush=True)
            return
        for n, orient in bad:
            P.part_path(root, folder, n, orient).with_suffix(".json").unlink(missing_ok=True)
        print("overlay check: re-rendering the failing parts once", flush=True)
        render_parts(folder, {n for n, _ in bad}, False, par, tabs)


def flicker_gate(folder: str, accept: bool):
    """Shimmer / z-fighting check on every part (flicker_qa.py, both orientations): flickering seconds outside the
    film's qa.json accept list stop the run before delivery, with scene-local frames and heat maps in out/qa, so a fix
    re-renders one part instead of a whole delivered film (a first delivery can ship with flickering trims)."""
    import flicker_qa as Q
    runlog.mark(folder, "flicker-qa", "start")
    bad = Q.check_film(folder)
    runlog.mark(folder, "flicker-qa", "end", note=f"{bad} flickering windows")
    if bad and not accept:
        raise SystemExit(f"flicker check: {bad} flickering one-second windows (heat maps in out/qa). Fix those shots and run again "
                         "(only their parts re-render), sign off intended motion in qa.json, or pass --accept-flicker.")
    print("flicker check: clean" if not bad else f"WARNING flicker check: {bad} windows accepted with --accept-flicker", flush=True)


# ---- 2. masters ---------------------------------------------------------------------------------------------------

def count_frames(video: Path) -> int:
    r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-count_packets", "-show_entries", "stream=nb_read_packets",
                        "-of", "csv=p=0", str(video)], capture_output=True, text=True)
    return int(r.stdout.strip() or 0)


def join(folder: str, t=None, rngs=None, hs=None, allow_stale=False):
    root = film_dir(folder)
    if t is None:
        t, rngs, _ = P.load(root)
        hs = P.hashes(root, t, rngs)
    out = root / "out"
    score = root / "public" / "score.wav"
    frames = sum(r["frames"] for r in rngs)
    runlog.mark(folder, "join", "start")
    for orient, name in (("16x9", f"{folder}-master.mp4"), ("9x16", f"{folder}-vertical-master.mp4")):
        files = [P.part_path(root, folder, r["n"], orient) for r in rngs]
        missing = [f.name for f in files if not f.exists()]
        if missing:
            raise SystemExit(f"cannot build {name}: missing {', '.join(missing)}")
        stale = [r["n"] for r in rngs if not P.is_fresh(P.part_path(root, folder, r["n"], orient), hs[(r["n"], orient)])]
        if stale:
            msg = f"{name}: part(s) {stale} are older than their sources"
            if not allow_stale:
                raise SystemExit(msg + " (render them, or pass --allow-stale)")
            print("WARNING " + msg, flush=True)
        lst = out / "parts" / f"_concat-{orient}.txt"
        lst.write_text("".join(f"file '{f.as_posix()}'\n" for f in files), encoding="utf-8")
        cmd = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-nostdin", "-y", "-f", "concat", "-safe", "0", "-i", lst]
        if score.exists():
            cmd += ["-i", score, "-map", "0:v:0", "-map", "1:a:0", "-c:a", "aac", "-b:a", "320k", "-ar", "48000", "-af", "apad", "-shortest"]
        cmd += ["-c:v", "copy", "-movflags", "+faststart", out / name]
        run(cmd, root)
        lst.unlink(missing_ok=True)
        got = count_frames(out / name)
        if got != frames:
            raise SystemExit(f"{name}: {got} frames after the join, expected {frames}")
        print(f"{name}: {len(files)} parts joined, {got} frames ({got / t['fps']:.2f}s)", flush=True)
    runlog.mark(folder, "join", "end")


# ---- 3. delivery --------------------------------------------------------------------------------------------------

def export(src: Path, preset: str, tmp: Path, dst: Path, tp: str, allow_long=False):
    cmd = [PY, FF / "export.py", src, "--preset", preset, "--nvenc", "--overwrite", "-o", tmp]
    if allow_long:
        cmd.insert(-2, "--allow-long")
    return [cmd, [PY, FF / "loudness.py", tmp, "-I", "-14", "--tp", tp, "-o", dst, "--overwrite", "--json-brief"]]


def narrated(folder: str):
    """Narrated masters (picture stream-copied, new mix) and their NVENC platform files.

    The voice transients make the AAC encoder overshoot a -1 dBTP ceiling by about 0.1 dB, so these aim at -1.5.
    """
    root = film_dir(folder)
    out = root / "out"
    run([PY, TOOLS / "mix.py", folder], root)
    wav = out / "_narrated.wav"
    pairs = [(f"{folder}-master.mp4", f"{folder}-master-narrated.mp4"), (f"{folder}-vertical-master.mp4", f"{folder}-vertical-master-narrated.mp4")]
    parallel([[[PY, FF / "audio.py", out / a, "--replace", wav, "-o", out / b, "--bitrate", "320k", "--overwrite", "--json-brief"]]
              for a, b in pairs if (out / a).exists()], root)
    wav.unlink(missing_ok=True)
    jobs = []
    if (out / f"{folder}-master-narrated.mp4").exists():
        jobs.append(export(out / f"{folder}-master-narrated.mp4", "youtube", out / "_ytn.mp4", out / f"{folder}-youtube-narrated.mp4", "-1.5"))
    if (out / f"{folder}-vertical-master-narrated.mp4").exists():
        jobs.append(export(out / f"{folder}-vertical-master-narrated.mp4", "reels", out / "_vtn.mp4", out / f"{folder}-vertical-narrated.mp4", "-1.5", True))
    parallel(jobs, root)
    for tmp in ("_ytn.mp4", "_vtn.mp4"):
        (out / tmp).unlink(missing_ok=True)


def deliver(folder: str):
    root = film_dir(folder)
    out = root / "out"
    runlog.mark(folder, "deliver", "start")
    run([PY, TOOLS / "srt.py", folder], root)
    narrated(folder)
    run([PY, TOOLS / "shorts.py", folder], root)
    try:
        print(chain([[PY, FF / "check.py", out / f"{folder}-youtube-narrated.mp4", "--platform", "youtube"]], root), flush=True)
    except RuntimeError as e:
        print(f"platform check reported problems:\n{e}", flush=True)
    parallel([[[PY, FF / "look.py", out / f"{folder}-youtube-narrated.mp4", "--tiles", "4x3", "-o", out / f"{folder}-youtube_sheet.png", "--overwrite"]],
              [[PY, FF / "look.py", out / f"{folder}-vertical-narrated.mp4", "--tiles", "6x2", "-o", out / f"{folder}-vertical_sheet.png", "--overwrite"]]], root)
    for tmp in ("_mux.mp4", "_narrated.wav"):
        (out / tmp).unlink(missing_ok=True)
    runlog.mark(folder, "deliver", "end")


def finish(folder: str, keep_masters: bool):
    """The clean-up of the delivery standard, or just the rebuild script when the masters are kept."""
    import cleanup
    if keep_masters:
        cleanup.write_bat(folder)
        print(f"{folder}: masters kept; run `python cleanup.py \"{folder}\"` when done with them", flush=True)
    else:
        cleanup.main(folder, False)


def main(folder: str, args: list):
    opt = {a.split("=")[0]: (a.split("=", 1)[1] if "=" in a else True) for a in args}
    keep = "--keep-masters" in opt
    if "--narrated-only" in opt:
        run([PY, TOOLS / "srt.py", folder], film_dir(folder))
        narrated(folder)
        run([PY, TOOLS / "shorts.py", folder], film_dir(folder))
        finish(folder, keep)
        return
    only = {int(x) for x in str(opt["--parts"]).split(",")} if "--parts" in opt else None
    par = 1 if "--serial" in opt else int(opt["--parallel"]) if "--parallel" in opt else None
    tabs = int(opt["--tabs"]) if "--tabs" in opt else None
    t0 = time.time()
    if "--no-render" in opt:
        join(folder, allow_stale="--allow-stale" in opt)
    else:
        t, rngs, hs = render_parts(folder, only, "--force" in opt, par, tabs)
        overlay_qa(folder, t, rngs, par, tabs)
        flicker_gate(folder, "--accept-flicker" in opt)
        join(folder, t, rngs, hs, allow_stale=bool(only) or "--allow-stale" in opt)
    if "--render-only" not in opt:
        deliver(folder)
        if "--interp" in opt or CFG["deliver"].get("interp"):
            import interp
            runlog.mark(folder, "interp", "start")
            interp.main(folder, [])
            runlog.mark(folder, "interp", "end")
        finish(folder, keep)
    print(f"DONE {folder} in {time.time() - t0:.0f}s", flush=True)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2:])
