"""Machine settings: WS/config.json merged over DEFAULTS. Run `python setup.py` on a new machine to check and fill it.

Keys:
  ffmpeg_dir          folder holding ffmpeg.exe / ffprobe.exe ("" = use PATH); needs an h264_nvenc build
  node_dir            folder holding node.exe ("" = use PATH)
  resolve_script_api  DaVinci Resolve scripting folder (Developer/Scripting)
  resolve_script_lib  fusionscript.dll
  render.parallel     part renders at once (each is one Chrome with `tabs` tabs: ~5 GB VRAM, ~3.5 GB RAM)
  render.tabs         Remotion concurrency per render (7 measured best on a 24-thread CPU)
  render.image_format "jpeg" or "png" (frame capture; jpeg is 1.9x faster)
  render.jpeg_quality 95 (100 is slower and barely different)
  render.encoder      "nvenc" (GPU) or "x264" (CPU); nvenc falls back to x264 if the GPU encoder fails
  render.video_bitrate  NVENC master bitrate (Remotion turns NVENC off when a CRF is set, so masters use a bitrate)
  render.x264_crf     CRF for the x264 fallback
  render.gl           Chrome GL backend ("angle" = D3D11 on the NVIDIA GPU)
  render.stall_s      a render with no new frames for this long is cancelled and retried once
  deliver.parallel    platform exports / Shorts encoded at once (NVENC sessions)
  deliver.keep_parts  keep out/parts/ after delivery (true while fixing a film: a fix re-renders only its part;
                      false = clean-up deletes them and a later fix re-renders every part, about 12 min per 7 min of film)
  deliver.interp      also make the 60 fps versions (interp.py: RIFE 2x on the GPU, about 8 min per orientation per 7 min)
  deliver.interp_bitrate  their NVENC average bitrate ("20M": ~1.1 GB per 7 min of film; raise to "30M"/"40M" if
                      fine detail ever breaks up)
"""
import json
import os
from pathlib import Path

WS = Path(__file__).resolve().parents[1]
PATH = WS / "config.json"

DEFAULTS = {
    "ffmpeg_dir": "",
    "node_dir": "",
    "resolve_script_api": r"C:\ProgramData\Blackmagic Design\DaVinci Resolve\Support\Developer\Scripting",
    "resolve_script_lib": r"C:\Program Files\Blackmagic Design\DaVinci Resolve\fusionscript.dll",
    "render": {
        "parallel": 2,
        "tabs": 7,
        "image_format": "jpeg",
        "jpeg_quality": 95,
        "encoder": "nvenc",
        "video_bitrate": "40M",
        "x264_crf": 16,
        "gl": "angle",
        "stall_s": 600,
    },
    "deliver": {"parallel": 3, "keep_parts": False, "interp": False, "interp_bitrate": "20M"},
}


def _merge(base: dict, over: dict) -> dict:
    out = dict(base)
    for k, v in over.items():
        out[k] = _merge(base[k], v) if isinstance(v, dict) and isinstance(base.get(k), dict) else v
    return out


def load() -> dict:
    if PATH.exists():
        return _merge(DEFAULTS, json.loads(PATH.read_text(encoding="utf-8-sig")))
    return json.loads(json.dumps(DEFAULTS))


def save(cfg: dict):
    PATH.write_text(json.dumps(cfg, indent=2) + "\n", encoding="utf-8")


def apply_env(cfg: dict | None = None):
    """Put the configured ffmpeg and node first on PATH and point the Resolve scripting variables at the install."""
    cfg = cfg or load()
    extra = [d for d in (cfg.get("ffmpeg_dir"), cfg.get("node_dir")) if d and Path(d).is_dir()]
    if extra:
        parts = os.environ.get("PATH", "").split(os.pathsep)
        os.environ["PATH"] = os.pathsep.join(extra + [p for p in parts if p not in extra])
    os.environ.setdefault("RESOLVE_SCRIPT_API", cfg["resolve_script_api"])
    os.environ.setdefault("RESOLVE_SCRIPT_LIB", cfg["resolve_script_lib"])
    return cfg
