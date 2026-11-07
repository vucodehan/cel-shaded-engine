"""Keep only a film's delivered files and write its rebuild script: python cleanup.py <film> [<film> ...] [--dry-run]

The delivery standard (user, Oct 12 2026): out/ keeps
  <film>-youtube-narrated.mp4, <film>-vertical-narrated.mp4 (and their -60fps versions), <film>-short-<k>-of-<N>.mp4,
  <film>-master-narrated.en_US.srt, <film>-vertical-master-narrated.en_US.srt,
  plus small non-video files (contact sheets, shorts.json, review stills) and rebuildvideo.bat.
Every other video or audio file goes: the 16:9 and 9:16 masters, the narrated masters, music-only exports, render
parts (unless config.json deliver.keep_parts is true), temporary files, and any other .srt.
out/rebuildvideo.bat brings the deleted videos back from the film's sources (scenes, narration, score):
`rebuildvideo.bat` rebuilds and keeps the masters (for Resolve or editing), `rebuildvideo.bat clean` rebuilds and then
deletes them again.
"""
import re
import sys
from pathlib import Path

from films import CFG, SRT, film_dir

MEDIA = {".mp4", ".mov", ".mkv", ".webm", ".wav", ".m4a", ".aac", ".mp3"}
KEEP_SRT = ("-master-narrated", "-vertical-master-narrated")

BAT = r"""@echo off
setlocal
rem Rebuild this film's videos after a clean-up deleted the masters: renders the parts that are missing, joins the
rem 16:9 and 9:16 masters, remixes the narration and re-delivers youtube-narrated, vertical-narrated, the Shorts and
rem the two SRTs. Needs the workspace's _tools next to the film folder, Python, node and ffmpeg (run setup.py once
rem on a new machine). The narration comes from the film's cached takes: no ElevenLabs credits are used.
rem   rebuildvideo.bat          rebuild and keep the masters (for Resolve, resolve_drp.py or edits)
rem   rebuildvideo.bat clean    rebuild, then delete the masters again so only the delivered files stay
for %%I in ("%~dp0..") do set "FILM=%%~nxI"
pushd "%~dp0..\..\_tools" || (echo Cannot find the _tools folder next to the film folder. & exit /b 1)
if /i "%~1"=="clean" (
  python pipeline.py "%FILM%"
) else (
  python pipeline.py "%FILM%" --keep-masters
)
set "ERR=%ERRORLEVEL%"
popd
if not "%ERR%"=="0" echo Rebuild failed with exit code %ERR%.
exit /b %ERR%
"""


def kept(name: str, folder: str) -> bool:
    if name in (f"{folder}-{k}-narrated{s}.mp4" for k in ("youtube", "vertical") for s in ("", "-60fps")):
        return True
    return re.fullmatch(re.escape(folder) + r"-short-\d+-of-\d+\.mp4", name) is not None


def write_bat(folder: str):
    out = film_dir(folder) / "out"
    out.mkdir(parents=True, exist_ok=True)
    (out / "rebuildvideo.bat").write_text(BAT, encoding="ascii", newline="\r\n")


def main(folder: str, dry: bool):
    out = film_dir(folder) / "out"
    if not out.exists():
        raise SystemExit(f"{folder}: no out/ folder")
    keep_parts = bool(CFG["deliver"].get("keep_parts"))
    gone, freed = [], 0
    for p in sorted(out.rglob("*")):
        if not p.is_file():
            continue
        rel = p.relative_to(out)
        in_parts = rel.parts[0] == "parts"
        if in_parts and keep_parts:
            continue
        suffix = p.suffix.lower()
        drop = False
        if suffix in MEDIA:
            drop = in_parts or len(rel.parts) > 1 or not kept(p.name, folder)
        elif p.name.endswith(".srt"):
            drop = not any(p.name == f"{folder}{k}{SRT}" for k in KEEP_SRT)
        elif in_parts:
            drop = True  # part sidecars and concat lists go with their videos
        if drop:
            gone.append(rel)
            freed += p.stat().st_size
            if not dry:
                p.unlink()
    if not dry:
        for d in sorted((x for x in out.rglob("*") if x.is_dir()), key=lambda x: -len(x.parts)):
            if not any(d.iterdir()):
                d.rmdir()
        write_bat(folder)
    print(f"{folder}: {'would delete' if dry else 'deleted'} {len(gone)} files, {freed / 2**30:.2f} GB"
          + ("" if dry else "; wrote out/rebuildvideo.bat"))
    for rel in gone:
        print(f"  - {rel}")


if __name__ == "__main__":
    dry = "--dry-run" in sys.argv
    for f in [a for a in sys.argv[1:] if not a.startswith("--")]:
        main(f, dry)
