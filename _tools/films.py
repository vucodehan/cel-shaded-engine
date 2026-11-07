"""Where things live, for every tool.

The workspace WS is the folder holding _tools/, _kit/, _state/ and the film folders. Everything is found from this
file's own location, so the whole folder can move to another drive or machine (then run `python setup.py`).
Importing this module also applies config.json (ffmpeg / node on PATH, Resolve scripting paths).
"""
from pathlib import Path

import config

TOOLS = Path(__file__).resolve().parent
WS = TOOLS.parent
KIT = WS / "_kit"
# The one Remotion install of this workspace. Every film's node_modules is a junction to it (scaffold.py / setup.py).
NODE = KIT / "node_modules"
STATE = WS / "_state"
TEXTS = TOOLS / "texts"
RESOLVE_DIR = TOOLS / "resolve"
FF = TOOLS / "ffmpeg"
# Captions sit beside each video as <video name>.en_US.srt: Facebook reads the language from <name>.<lang>_<COUNTRY>.srt.
SRT = ".en_US.srt"

CFG = config.apply_env()
STATE.mkdir(exist_ok=True)


def film_dir(folder: str) -> Path:
    return WS / folder


def srt_for(video: Path) -> Path:
    return video.with_name(video.stem + SRT)


def take(root: Path, clip: dict) -> Path:
    """A narration take inside the film, whatever absolute path was recorded before the film was moved."""
    return root / "narration" / "lines" / Path(clip["file"]).name


def all_films():
    return sorted(p.parent.parent for p in WS.glob("*/src/script.json"))
