"""Static checks on a film's scene files: python lint_scenes.py <film> [--strict]

Catches the authoring patterns that caused rework before anything renders:
  ERROR  raw yaw interpolation: lerp() on a facing (yaw / face / toward() / +-360) instead of turnYaw / turnOnSpot /
         walkTo's fromYaw-toYaw. lerp(84, 163 + 360, t) spun a figure 439 degrees in half a second.
  WARN   fast oscillation on a frame count: Math.sin(fs * k) with k > 1.2 rad per frame: on twos it reverses almost
         every held pose and reads as a shake (a pen at 1.9 rad, a quill at 1.7 rad).
  WARN   per-frame randomness: random(`...${f}`) / random(`...${frame}`): a new value every frame strobes; step it on twos.
Prints file:line and the line. Exit code 1 when an ERROR is found (or any WARN with --strict). preflight.py runs it.
"""
import re
import sys
from pathlib import Path

from films import film_dir

YAW_WORDS = re.compile(r"\b(yaw|Yaw|YAW|face|Face|facing|toward|heading)\b|[+-]\s*360\b")
LERP_CALL = re.compile(r"\blerp\(")
PLACE_LERP = re.compile(r"\.place\([^;]*\blerp\(")
FAST_SIN = re.compile(r"Math\.(sin|cos)\(\s*\(?\s*(fs|Fs|F|f|frame|t\s*\*\s*30)\s*\)?\s*\*\s*([0-9]*\.?[0-9]+)")
FRAME_RANDOM = re.compile(r"random\(`[^`]*\$\{\s*(f|frame|fs)\s*\}")
CAM_LINE = re.compile(r"\bk\.cam(At)?\(|\bcam\(\{|\bmapCam\(|yaw: lerp")


def lerp_args(s: str):
    """The argument text of every lerp( ... ) call on the line (balanced parentheses)."""
    for m in LERP_CALL.finditer(s):
        depth, i = 1, m.end()
        while i < len(s) and depth:
            depth += {"(": 1, ")": -1}.get(s[i], 0)
            i += 1
        yield s[m.end():i - 1]


def lint(path: Path):
    out = []
    for n, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        s = line.strip()
        if s.startswith("//") or s.startswith("*"):
            continue
        # camera orbits (k.cam yaw) are angles about a target, not a figure's facing: allowed
        if not CAM_LINE.search(s) and any(YAW_WORDS.search(a) for a in lerp_args(s)):
            out.append(("ERROR", n, "raw yaw interpolation: use turnYaw / turnOnSpot / walkTo({ fromYaw, toYaw })", s))
        for m in FAST_SIN.finditer(s):
            if float(m.group(3)) > 1.2:
                out.append(("WARN", n, f"oscillates {m.group(3)} rad per frame: on twos it reverses almost every pose (keep it under ~1.2)", s))
        if FRAME_RANDOM.search(s):
            out.append(("WARN", n, "per-frame random value strobes: seed it with a stepped frame (Math.floor(f / 2) * 2)", s))
        if CAM_LINE.search(s) and (".root.position" in s or re.search(r"camAt\([^;]*\.(aim|point)\(", s)):
            out.append(("WARN", n, "camera placed from a character point that moves on twos: the whole frame steps; use a fixed anchor or a smooth path at f", s))
        if re.search(r"\bconst\s+\w+\s*=\s*\w+\.root\.position\s*;", s):
            out.append(("WARN", n, "a character's root moves on twos: a camera built from it steps the whole frame (use the walk path at f)", s))
    return out


def main(args):
    folder = args[0]
    strict = "--strict" in args
    root = film_dir(folder)
    errs = warns = 0
    for p in sorted((root / "src" / "scenes").glob("*.tsx")) + sorted((root / "src" / "scenes").glob("*.ts")):
        for level, n, msg, s in lint(p):
            print(f"  {level} {p.name}:{n}: {msg}\n        {s[:150]}")
            errs += level == "ERROR"
            warns += level == "WARN"
    print(f"{folder}: scene lint: {errs} errors, {warns} warnings")
    return 1 if errs or (strict and warns) else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
