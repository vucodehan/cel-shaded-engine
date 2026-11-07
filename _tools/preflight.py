"""Check that films are ready to render: python preflight.py <film> [<film> ...] [--no-tsc]

Per film: script.json, timing.json and narration/cues.json present; every narration take on disk; public/score.wav as
long as the film; src/scenes/index has a VISUALS entry for every scene id; node_modules linked to _kit/node_modules;
the parts plan valid (parts.py); `npx tsc -p .` clean (skip with --no-tsc); lint_scenes.py without errors (raw yaw
interpolation). Run preview.py <film> --all (the motion / flicker check) before rendering. Also checks the machine: ffmpeg with
h264_nvenc, node, config.json, and lists heavy jobs already running (queue runner, pipeline, Shorts, ffmpeg, Remotion)
in either workspace. Prints one line per film, READY or the problems found; exit code 1 if any film is not ready or a
heavy job is running.
"""
import json
import os
import re
import shutil
import subprocess
import sys
import wave

import parts as P
from films import CFG, NODE, film_dir, take


def busy():
    """Heavy jobs already running anywhere on the machine (this workspace or another)."""
    ps = "Get-CimInstance Win32_Process -Filter \"Name='python.exe' OR Name='ffmpeg.exe' OR Name='node.exe'\" | ForEach-Object { $_.CommandLine }"
    out = subprocess.run(["powershell", "-NoProfile", "-Command", ps], capture_output=True, text=True).stdout
    tags = {"queue_runner.py": "queue runner", "pipeline.py": "pipeline", "shorts.py": "shorts", "ffmpeg": "ffmpeg",
            "remotion": "remotion render", "render_parts.mjs": "part renders"}
    me = str(os.getpid())
    lines = [l for l in out.splitlines() if "preflight.py" not in l and me not in l]
    return sorted({name for line in lines for key, name in tags.items() if key in line.lower()})


def machine():
    problems = []
    ff = shutil.which("ffmpeg")
    if not ff:
        problems.append("ffmpeg not found (set ffmpeg_dir in config.json)")
    elif "h264_nvenc" not in subprocess.run([ff, "-hide_banner", "-encoders"], capture_output=True, text=True).stdout:
        problems.append("this ffmpeg has no h264_nvenc encoder")
    if not shutil.which("node"):
        problems.append("node not found (set node_dir in config.json)")
    if not NODE.exists():
        problems.append("_kit/node_modules missing: run python setup.py")
    return problems


def check(folder, tsc=True):
    root = film_dir(folder)
    problems = []
    src = root / "src"
    for name in ("script.json", "timing.json"):
        if not (src / name).exists():
            problems.append(f"missing src/{name}")
    index = next((p for p in (src / "scenes" / "index.ts", src / "scenes" / "index.tsx") if p.exists()), None)
    if not index:
        problems.append("missing src/scenes/index.ts")
    cues_p = root / "narration" / "cues.json"
    if not cues_p.exists():
        problems.append("missing narration/cues.json")
    if problems:
        return problems
    timing = json.loads((src / "timing.json").read_text(encoding="utf-8"))
    ids = [s["id"] for s in timing["scenes"]]
    frames = P.total(timing)
    cues = json.loads(cues_p.read_text(encoding="utf-8"))
    missing = [c["file"] for c in cues["clips"] if not take(root, c).exists()]
    if missing:
        problems.append(f"{len(missing)} narration takes missing (first: {missing[0]})")
    if cues.get("frames") and abs(cues["frames"] - frames) > 1:
        problems.append(f"cues.json is {cues['frames']} frames but timing.json is {frames}: re-run plan.py")
    score = root / "public" / "score.wav"
    if not score.exists():
        problems.append("missing public/score.wav: run scripts/score.py")
    else:
        with wave.open(str(score)) as w:
            sec = w.getnframes() / w.getframerate()
        if abs(sec - frames / timing["fps"]) > 0.25:
            problems.append(f"score.wav is {sec:.1f}s but the film is {frames / timing['fps']:.1f}s: re-run scripts/score.py")
    block = index.read_text(encoding="utf-8")
    block = block[block.find("VISUALS"):]
    keys = set(re.findall(r"[{,\s]\"?([A-Za-z_]\w*)\"?\s*:", block))
    lacking = [i for i in ids if i not in keys]
    if lacking:
        problems.append(f"VISUALS lacks scene ids: {', '.join(lacking)}")
    nm = root / "node_modules"
    if not nm.exists():
        problems.append("node_modules missing: run scaffold.py")
    elif not os.path.samefile(nm, NODE):
        problems.append(f"node_modules points at {os.path.realpath(nm)}, not {NODE}: run scaffold.py")
    try:
        _, rngs, _ = P.load(root)
        if any(r["sec"] > P.LIMIT for r in rngs):
            problems.append("a part is longer than 178 s")
    except SystemExit as e:
        problems.append(f"parts: {e}")
    if tsc and not problems:
        r = subprocess.run("npx tsc -p .", cwd=root, shell=True, capture_output=True, text=True)
        if r.returncode != 0:
            first = (r.stdout or r.stderr).strip().splitlines()[:3]
            problems.append("tsc errors: " + " | ".join(first))
    import lint_scenes
    lint_errs = [f"{p.name}:{n}" for p in sorted((src / "scenes").glob("*.ts*")) for level, n, _, _ in lint_scenes.lint(p) if level == "ERROR"]
    if lint_errs:
        problems.append(f"scene lint errors (python lint_scenes.py {folder}): {', '.join(lint_errs[:6])}")
    return problems


def main(args):
    tsc = "--no-tsc" not in args
    films = [a for a in args if not a.startswith("--")]
    bad = 0
    mp = machine()
    print(f"{'machine':48} {'OK' if not mp else 'PROBLEMS: ' + '; '.join(mp)}  (render {CFG['render']['parallel']} x {CFG['render']['tabs']} tabs, {CFG['render']['encoder']})")
    for folder in films:
        problems = check(folder, tsc)
        bad += bool(problems)
        print(f"{folder:48} {'READY' if not problems else 'NOT READY: ' + '; '.join(problems)}", flush=True)
    jobs = busy()
    print(f"heavy jobs running: {', '.join(jobs) + ' (wait for them to finish; never start a second runner)' if jobs else 'none'}")
    sys.exit(1 if bad or jobs or mp else 0)


if __name__ == "__main__":
    main(sys.argv[1:])
