"""Motion check before the render: python preview.py <film> <scene> [<scene> ...] [--all] [--v] [--bitrate 80M]

Stills cannot show flicker. This renders each scene's visible frames (CelFilm's cut-in to cut-out) at full size with
the part renderer (render_parts.mjs: same engine, JPEG frames, near-lossless x264 CRF 8 so codec noise stays out of
the check), then runs flicker_qa on the result: z-fighting surfaces, crawling lines, jittering hands, strobing
shakes, sub-pixel sparkle. Each flickering second is printed with its scene-local frames and written as a heat map
(out/qa/flicker-<scene>-<frame>.jpg: the frame with the flickering pixels in red). Intended motion (a particle stream,
travellers on a path) is signed off in the film's qa.json "accept" list after looking at its heat map.

Every scene agent runs this on its scenes before reporting done (BRIEF), and once on --all before pipeline.py.
Exit code 1 if any scene flickers outside the accept list. Previews land in out/qa/preview-<scene>-<orient>.mp4.
"""
import json
import subprocess
import sys
from pathlib import Path

import flicker_qa as Q
from films import CFG, TOOLS, film_dir


def main(args):
    flags = {a.split("=")[0]: (a.split("=", 1)[1] if "=" in a else True) for a in args if a.startswith("--")}
    names = [a for a in args if not a.startswith("--")]
    folder, want = names[0], names[1:]
    root = film_dir(folder)
    timing = json.loads((root / "src" / "timing.json").read_text(encoding="utf-8"))
    ov = timing["overlap"]
    starts, s = {}, 0
    for sc in timing["scenes"]:
        starts[sc["id"]] = (s, sc)
        s += sc["duration"] - ov
    ids = [sc["id"] for sc in timing["scenes"]] if flags.get("--all") else want
    unknown = [i for i in ids if i not in starts]
    if unknown or not ids:
        raise SystemExit(f"unknown or missing scenes: {unknown or 'none given'} (ids: {', '.join(starts)})")
    orient, comp = ("9x16", "FilmVertical") if flags.get("--v") else ("16x9", "Film")
    qa = root / "out" / "qa"
    qa.mkdir(parents=True, exist_ok=True)
    jobs, spans = [], {}
    for i in ids:
        s0, sc = starts[i]
        a = s0 + (ov // 2 if s0 else 0)
        b = s0 + sc["duration"] - (ov - ov // 2) - 1
        out = qa / f"preview-{i}-{orient}.mp4"
        jobs.append({"id": f"{i}-{orient}", "comp": comp, "frameRange": [a, b], "out": str(out)})
        spans[i] = (a, out)
    render = dict(CFG["render"])
    # near-lossless x264 (CRF 8): NVENC's B-frames pulse thin bright lines between sharp and soft, which reads as flicker
    render["encoder"], render["x264_crf"] = "x264", int(flags.get("--crf", 8))
    spec = {"root": str(root), "render": render, "jobs": jobs}
    spec_p = qa / "_preview_jobs.json"
    spec_p.write_text(json.dumps(spec, indent=1), encoding="utf-8")
    print(f"{folder}: previewing {len(jobs)} scene(s) {orient} ({sum(j['frameRange'][1] - j['frameRange'][0] + 1 for j in jobs)} frames)", flush=True)
    if not flags.get("--no-render"):  # --no-render: check the previews already on disk again
        r = subprocess.run(["node", str(TOOLS / "render_parts.mjs"), str(spec_p)], cwd=root)
        if r.returncode != 0:
            raise SystemExit("preview render failed (see the lines above)")
    from concurrent.futures import ProcessPoolExecutor
    accept = Q.load_accept(root)
    bad = 0
    with ProcessPoolExecutor(max_workers=min(8, len(ids))) as ex:
        futs = {i: ex.submit(Q.check_video, spans[i][1], timing, spans[i][0], 0.0, None, 12, qa, f"{i}-", Q.THRESH, accept) for i in ids}
        for i in ids:
            rows, n = futs[i].result()
            bad += Q.report(spans[i][1].name, rows, n)
    print(f"{'FLICKER: fix the shots above (heat maps in out/qa) or accept intended motion in qa.json' if bad else 'motion check clean'}")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
