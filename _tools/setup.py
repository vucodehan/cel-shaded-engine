"""Set up or check this workspace on a machine: python setup.py [--apply] [--install]

Run it after copying the workspace to another computer (or another drive), and whenever something looks off.
  1. Python 3.10+ with numpy, scipy, Pillow
  2. node; the workspace's Remotion install (_kit/node_modules; --install runs `npm ci` there when it is missing)
  3. ffmpeg / ffprobe with a working h264_nvenc (a one-second test encode on the GPU)
  4. the NVIDIA GPU, VRAM, CPU threads and RAM -> a suggested render.parallel (part renders at once)
  5. which GPU Chrome's WebGL draws on (must be the NVIDIA card, through ANGLE / D3D11)
  6. DaVinci Resolve scripting paths (only needed for resolve_drp.py)
  7. every film's node_modules junction, re-pointed at _kit/node_modules (junctions store absolute paths, so a moved
     workspace always needs this)
config.json is created when missing; with --apply the detected ffmpeg_dir, node_dir, machine and the suggested
render.parallel are written into an existing one. Fonts come from Google Fonts at render time: renders need internet.
"""
import json
import os
import platform
import shutil
import subprocess
import sys
from pathlib import Path

import config
from films import KIT, NODE, WS

OK, WARN, BAD = "ok  ", "WARN", "FAIL"
results = []


def report(state, what, detail=""):
    results.append(state)
    print(f"[{state}] {what}" + (f": {detail}" if detail else ""), flush=True)


def out(cmd, **kw):
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=kw.pop("timeout", 120), **kw)
        return r.returncode, (r.stdout + r.stderr).strip()
    except (OSError, subprocess.TimeoutExpired) as e:
        return 1, str(e)


def python_check():
    v = sys.version_info
    report(OK if v >= (3, 10) else BAD, "Python", f"{platform.python_version()} at {sys.executable}")
    missing = []
    for mod, pkg in (("numpy", "numpy"), ("scipy", "scipy"), ("PIL", "Pillow")):
        try:
            __import__(mod)
        except ImportError:
            missing.append(pkg)
    report(BAD if missing else OK, "Python packages", f"pip install {' '.join(missing)}" if missing else "numpy, scipy, Pillow")


def node_check(install):
    node = shutil.which("node")
    if not node:
        report(BAD, "node", "not found: install Node.js 20+ or set node_dir in config.json")
        return None
    code, v = out([node, "--version"])
    report(OK, "node", f"{v} at {node}")
    if not (NODE / "remotion" / "package.json").exists():
        if install:
            print("running npm ci in _kit (needs internet) ...", flush=True)
            code, log = out(["npm", "ci"], cwd=KIT, shell=True, timeout=1800)
            report(OK if code == 0 else BAD, "npm ci", log.splitlines()[-1] if log else "")
        else:
            report(BAD, "Remotion install", "_kit/node_modules missing: run python setup.py --install")
            return node
    pkg = json.loads((NODE / "remotion" / "package.json").read_text(encoding="utf-8"))
    three = NODE / "three" / "package.json"
    report(OK, "Remotion install", f"remotion {pkg['version']}" + (f", three {json.loads(three.read_text(encoding='utf-8'))['version']}" if three.exists() else ""))
    chrome = NODE / ".remotion" / "chrome-headless-shell"
    report(OK if chrome.exists() else WARN, "Chrome Headless Shell", "present" if chrome.exists() else "downloads on the first render (needs internet)")
    return node


def ffmpeg_check(cfg):
    ff, fp = shutil.which("ffmpeg"), shutil.which("ffprobe")
    if not ff or not fp:
        report(BAD, "ffmpeg", "ffmpeg/ffprobe not found: install a full build (gyan.dev) and set ffmpeg_dir in config.json")
        return None
    code, enc = out([ff, "-hide_banner", "-encoders"])
    if "h264_nvenc" not in enc:
        report(BAD, "ffmpeg", f"{ff} has no h264_nvenc encoder")
        return ff
    code, log = out([ff, "-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc2=s=1920x1080:r=30:d=1", "-c:v", "h264_nvenc", "-f", "null", "-"])
    report(OK if code == 0 else BAD, "NVENC test encode", "h264_nvenc works" if code == 0 else log[-300:])
    return ff


def hardware(cfg):
    code, smi = out(["nvidia-smi", "--query-gpu=name,memory.total,driver_version", "--format=csv,noheader,nounits"])
    vram = 0.0
    gpu = "?"
    if code == 0 and smi:
        gpu, mem, drv = [x.strip() for x in smi.splitlines()[0].split(",")]
        vram = float(mem) / 1024
        report(OK, "GPU", f"{gpu}, {vram:.0f} GB VRAM, driver {drv}")
    else:
        report(BAD, "GPU", "nvidia-smi failed: NVIDIA driver missing?")
    threads = os.cpu_count() or 8
    code, ram_txt = out(["powershell", "-NoProfile", "-Command", "(Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory"])
    ram = float(ram_txt) / 2**30 if code == 0 and ram_txt.strip().isdigit() else 16.0
    code, cpu = out(["powershell", "-NoProfile", "-Command", "(Get-CimInstance Win32_Processor | Select-Object -First 1).Name"])
    # Measured on the RTX 5080 laptop: one 7-tab render needs ~5 GB VRAM, ~3.5 GB RAM and ~10 CPU threads;
    # two at once was the best there (a third ran out of RAM next to Cursor, a browser and Resolve).
    par = max(1, min(int(vram // 6), int(ram // 12), threads // 10, 4))
    report(OK, "CPU / RAM", f"{cpu.strip()}, {threads} threads, {ram:.0f} GB RAM -> suggested render.parallel {par} (now {cfg['render']['parallel']})")
    return {"gpu": gpu, "vram": vram, "ram": ram, "threads": threads, "cpu": cpu.strip(), "parallel": par}


def webgl_check(node):
    if not node or not (KIT / "scripts" / "gpuinfo.mjs").exists():
        return
    code, log = out([node, "scripts/gpuinfo.mjs"], cwd=KIT, timeout=180)
    line = log.splitlines()[-1] if log else ""
    good = "NVIDIA" in line and "SwiftShader" not in line
    report(OK if good else BAD, "Chrome WebGL", line[:200] or "no output")


def resolve_check(cfg):
    api, lib = Path(cfg["resolve_script_api"]), Path(cfg["resolve_script_lib"])
    ok = api.exists() and lib.exists()
    report(OK if ok else WARN, "DaVinci Resolve scripting", "found" if ok else "not found (only resolve_drp.py needs it; set the paths in config.json)")


def junctions():
    import scaffold
    fixed, films = [], [d for d in sorted(WS.iterdir()) if d.is_dir() and (d / "src").is_dir() and not d.name.startswith("_")]
    for d in films:
        try:
            if scaffold.junction(d):
                fixed.append(d.name)
        except SystemExit as e:
            report(BAD, f"node_modules of {d.name}", str(e))
    report(OK, "film junctions", f"{len(films)} films" + (f", re-linked: {', '.join(fixed)}" if fixed else ", all linked"))


def main(args):
    apply, install = "--apply" in args, "--install" in args
    cfg = config.load()
    print(f"workspace {WS}\nconfig    {config.PATH} ({'present' if config.PATH.exists() else 'missing'})\n", flush=True)
    python_check()
    node = node_check(install)
    ff = ffmpeg_check(cfg)
    hw = hardware(cfg)
    webgl_check(node)
    resolve_check(cfg)
    if NODE.exists():
        junctions()
    detected = {"ffmpeg_dir": str(Path(ff).parent) if ff else cfg["ffmpeg_dir"], "node_dir": str(Path(node).parent) if node else cfg["node_dir"]}
    if not config.PATH.exists() or apply:
        if not config.PATH.exists():
            cfg = json.loads(json.dumps(config.DEFAULTS))
        cfg.update(detected)
        cfg["machine"] = f"{hw['cpu']} ({hw['threads']} threads), {hw['ram']:.0f} GB RAM, {hw['gpu']} {hw['vram']:.0f} GB"
        cfg["render"]["parallel"] = hw["parallel"]
        config.save(cfg)
        report(OK, "config.json", f"written (render.parallel {hw['parallel']})")
    print(f"\n{results.count(OK)} ok, {results.count(WARN)} warnings, {results.count(BAD)} failures")
    sys.exit(1 if BAD in results else 0)


if __name__ == "__main__":
    main(sys.argv[1:])
