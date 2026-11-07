"""Render parts of a film: python parts.py <film> [--replan]     (prints the plan and which parts are stale)

A film is rendered, fixed and re-rendered in parts of at most 178 s, cut at scene boundaries. CelFilm hard-cuts in
the middle of each scene overlap (overlap // 2 frames into the next scene), and a part starts exactly on that cut,
so neighbouring parts share no frames: the full film is the parts joined end to end without re-encoding, and each
9:16 part is one YouTube Short (under 3 minutes).

<film>/parts.json keeps the scene grouping. It is kept as long as every part stays within 40-178 s, so a narration
fix in one part does not move the others; --replan (or a part out of bounds) plans afresh, choosing the most even
split.

Each rendered part has a content hash: its scenes' entries in timing.json, the scene files that draw them (from
src/scenes/index.ts, plus scene files they import), every other source file of the film (engine, CelFilm, common.ts,
public assets except audio, remotion.config.ts, package-lock.json) and the render settings. pipeline.py re-renders
only parts whose hash changed. A new part file appears next to out/parts/<film>-part<k>-<16x9|9x16>.mp4 with a .json
sidecar holding its hash.
"""
import hashlib
import json
import math
import re
import sys
from pathlib import Path

from films import CFG, film_dir

LIMIT, FLOOR = 178.0, 40.0
ORIENTS = {"16x9": "Film", "9x16": "FilmVertical"}
AUDIO = {".wav", ".mp3", ".m4a", ".aac", ".flac", ".ogg"}


def timing_of(root: Path) -> dict:
    return json.loads((root / "src" / "timing.json").read_text(encoding="utf-8-sig"))


def starts(t: dict) -> list:
    out, s = [], 0
    for sc in t["scenes"]:
        out.append(s)
        s += sc["duration"] - t["overlap"]
    return out


def total(t: dict) -> int:
    return starts(t)[-1] + t["scenes"][-1]["duration"]


def cut(t: dict, i: int) -> int:
    """The frame where scene i's picture starts (CelFilm's hard cut in the middle of the overlap)."""
    return 0 if i == 0 else starts(t)[i] + t["overlap"] // 2


def plan(t: dict) -> list:
    """Most even split into parts of FLOOR..LIMIT seconds at scene boundaries (the end card stays with the last part)."""
    fps, scenes = t["fps"], t["scenes"]
    n_sc = len(scenes)
    cands = [i for i in range(1, n_sc) if scenes[i].get("kind") != "end"]
    ends = [cut(t, i) for i in cands] + [total(t)]
    dur = total(t) / fps
    for n in range(max(1, math.ceil(dur / LIMIT)), 10):
        target = dur / n
        best = [{-1: (0.0, [])}] + [dict() for _ in range(n)]
        for k in range(1, n + 1):
            for j in range(len(ends)):
                if (k == n) != (j == len(ends) - 1):
                    continue
                for i, (cost, cuts) in best[k - 1].items():
                    if i >= j:
                        continue
                    length = (ends[j] - (0 if i < 0 else ends[i])) / fps
                    if not FLOOR <= length <= LIMIT:
                        continue
                    c = cost + (length - target) ** 2
                    if j not in best[k] or c < best[k][j][0]:
                        best[k][j] = (c, cuts + [j])
        if len(ends) - 1 in best[n]:
            firsts = [0] + [cands[j] for j in best[n][len(ends) - 1][1][:-1]]
            ids = [s["id"] for s in scenes]
            return [ids[a:b] for a, b in zip(firsts, firsts[1:] + [n_sc])]
    raise SystemExit("no split keeps every part between 40 and 178 s: split a scene that is longer than 178 s")


def ranges(t: dict, groups: list) -> list:
    """[{n, scenes, a, b, frames, sec}] with a/b the part's first and one-past-last frame of the full film."""
    idx = {s["id"]: i for i, s in enumerate(t["scenes"])}
    out = []
    for n, ids in enumerate(groups, 1):
        a = cut(t, idx[ids[0]])
        last = idx[ids[-1]]
        b = cut(t, last + 1) if last + 1 < len(t["scenes"]) else total(t)
        out.append({"n": n, "scenes": ids, "a": a, "b": b, "frames": b - a, "sec": round((b - a) / t["fps"], 3)})
    return out


def valid(t: dict, groups: list) -> bool:
    ids = [s["id"] for s in t["scenes"]]
    if [i for g in groups for i in g] != ids or any(not g for g in groups):
        return False
    return all(FLOOR <= r["sec"] <= LIMIT for r in ranges(t, groups)) or len(groups) == 1 and ranges(t, groups)[0]["sec"] <= LIMIT


def load(root: Path, replan: bool = False) -> tuple[dict, list, bool]:
    """(timing, ranges, replanned). Writes parts.json when the plan is new."""
    t = timing_of(root)
    pj = root / "parts.json"
    groups = json.loads(pj.read_text(encoding="utf-8"))["parts"] if pj.exists() and not replan else None
    groups = [g["scenes"] for g in groups] if groups else None
    fresh = not groups or not valid(t, groups)
    if fresh:
        groups = plan(t)
        doc = {"note": "Render parts (scene ids). Kept while every part stays 40-178 s; `python parts.py <film> --replan` re-plans.",
               "limit_s": LIMIT, "floor_s": FLOOR, "parts": [{"n": i + 1, "scenes": g} for i, g in enumerate(groups)]}
        pj.write_text(json.dumps(doc, indent=2) + "\n", encoding="utf-8")
    return t, ranges(t, groups), fresh


# ---- content hashes -------------------------------------------------------------------------------------------

IMPORT = re.compile(r"""import\s+(?:[\w*\s{},]+\s+from\s+)?["'](\.[^"']+)["']""")


def _module(base: Path, spec: str) -> Path | None:
    p = (base / spec).resolve()
    for cand in (p, p.with_suffix(".tsx"), p.with_suffix(".ts"), p / "index.tsx", p / "index.ts"):
        if cand.is_file():
            return cand
    return None


def scene_files(root: Path) -> dict:
    """scene id -> scene module files that draw it (src/scenes/index.ts mapping + scene modules they import)."""
    sdir = root / "src" / "scenes"
    index = next((p for p in (sdir / "index.ts", sdir / "index.tsx") if p.exists()), None)
    if index is None:
        return {}
    index = index.read_text(encoding="utf-8")
    name_file = {}
    for names, spec in re.findall(r"import\s*\{([^}]*)\}\s*from\s*[\"'](\.[^\"']+)[\"']", index):
        f = _module(sdir, spec)
        for nm in names.split(","):
            nm = nm.strip().split(" as ")[-1].strip()
            if nm and f:
                name_file[nm] = f
    block = index[index.find("VISUALS"):]
    direct = {sid: name_file[nm] for sid, nm in re.findall(r"[\"']?([A-Za-z_]\w*)[\"']?\s*:\s*([A-Za-z_]\w*)", block) if nm in name_file}
    modules = set(direct.values())
    deps = {}
    for m in modules:
        deps[m] = {d for spec in IMPORT.findall(m.read_text(encoding="utf-8")) if (d := _module(m.parent, spec)) in modules}
    out = {}
    for sid, m in direct.items():
        seen, todo = set(), [m]
        while todo:
            x = todo.pop()
            if x not in seen:
                seen.add(x)
                todo += deps.get(x, ())
        out[sid] = seen
    return out


def shared_digest(root: Path, scene_mods: set) -> str:
    """Hash of every source file a part's picture depends on besides its own scenes."""
    h = hashlib.sha256()
    files = [p for p in (root / "src").rglob("*") if p.is_file()]
    files += [p for p in (root / "public").rglob("*") if p.is_file() and p.suffix.lower() not in AUDIO] if (root / "public").exists() else []
    files += [root / n for n in ("remotion.config.ts", "package-lock.json") if (root / n).exists()]
    skip = {root / "src" / "timing.json", root / "src" / "script.json"}
    for p in sorted(set(files) - skip - scene_mods):
        h.update(str(p.relative_to(root)).replace("\\", "/").encode())
        h.update(p.read_bytes())
    return h.hexdigest()


def render_settings(orient: str) -> dict:
    r = CFG["render"]
    keys = ("image_format", "jpeg_quality", "encoder", "video_bitrate", "x264_crf", "gl")
    return {"comp": ORIENTS[orient], **{k: r[k] for k in keys}}


def hashes(root: Path, t: dict, rngs: list) -> dict:
    """{(n, orient): hash} for every part and orientation."""
    sf = scene_files(root)
    shared = shared_digest(root, {m for s in sf.values() for m in s})
    meta = json.dumps({k: v for k, v in t.items() if k != "scenes"}, sort_keys=True, ensure_ascii=False)
    by_id = {s["id"]: s for s in t["scenes"]}
    out = {}
    for r in rngs:
        body = hashlib.sha256()
        body.update(shared.encode())
        body.update(meta.encode())
        for sid in r["scenes"]:
            body.update(json.dumps(by_id[sid], sort_keys=True, ensure_ascii=False).encode())
            for m in sorted(sf.get(sid, ())):
                body.update(m.read_bytes())
        for orient in ORIENTS:
            h = body.copy()
            h.update(json.dumps(render_settings(orient), sort_keys=True).encode())
            out[(r["n"], orient)] = h.hexdigest()[:20]
    return out


def part_path(root: Path, folder: str, n: int, orient: str) -> Path:
    return root / "out" / "parts" / f"{folder}-part{n}-{orient}.mp4"


def is_fresh(path: Path, h: str) -> bool:
    side = path.with_suffix(".json")
    if not path.exists() or not side.exists():
        return False
    try:
        return json.loads(side.read_text(encoding="utf-8")).get("hash") == h
    except ValueError:
        return False


def main(folder: str, replan: bool):
    root = film_dir(folder)
    t, rngs, fresh = load(root, replan)
    hs = hashes(root, t, rngs)
    print(f"{folder}: {total(t) / t['fps']:.1f}s in {len(rngs)} parts" + (" (new plan written to parts.json)" if fresh else ""))
    for r in rngs:
        state = []
        for orient in ORIENTS:
            ok = is_fresh(part_path(root, folder, r["n"], orient), hs[(r["n"], orient)])
            state.append(f"{orient} {'ok' if ok else 'STALE'}")
        print(f"  part {r['n']}: frames {r['a']:6}-{r['b'] - 1:6}  {r['sec']:6.1f}s  {r['scenes'][0]} .. {r['scenes'][-1]}  ({', '.join(state)})")


if __name__ == "__main__":
    main(sys.argv[1], "--replan" in sys.argv)
