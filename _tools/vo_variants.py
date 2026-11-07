"""Try several takes of one narration line: python vo_variants.py <film> <scene> <group> [--seeds=11,12,13]
        [--stability=0.5] [--prev="unspoken context before"] [--next="unspoken context after"]

Each take goes straight into narration/cache under the key narrate.py will use for those settings, so choosing
one costs nothing more: write its `seed` (and `stability`, `ctxPrev`, `ctxNext`) into that group of script.json,
then run narrate.py and plan.py. Prints a delivery profile per take, measured from the audio and the ElevenLabs
character timings:
  dur       seconds of speech (slower reads as more deliberate)
  pause@    the longest pause inside the line (ms) and the word after which it falls
  end       pitch of the last word against the line's median (semitones; negative = a settled, falling close)
  range     pitch range in semitones (wider = more expressive)
Copies of the takes are written to narration/variants/<scene>-g<group>/ for listening.
"""
import json
import shutil
import sys

import numpy as np

import narrate as N
from films import film_dir


def f0_track(a: np.ndarray, sr: int):
    """(times, Hz) of voiced 20 ms frames by normalised autocorrelation (70-400 Hz)."""
    hop, win = sr // 100, int(sr * 0.04)
    lo, hi = sr // 400, sr // 70
    ts, fs = [], []
    for k in range(0, len(a) - win, hop):
        x = a[k : k + win].astype(np.float64)
        x -= x.mean()
        e = (x * x).sum()
        if e < 1e3 * win:
            continue
        ac = np.correlate(x, x, "full")[win - 1 :]
        lag = lo + int(np.argmax(ac[lo:hi]))
        if ac[lag] / ac[0] > 0.45:
            ts.append(k / sr)
            fs.append(sr / lag)
    return np.array(ts), np.array(fs)


def profile(a: np.ndarray, words: list):
    sr = N.SR
    ts, fs = f0_track(a, sr)
    st = 12 * np.log2(fs / np.median(fs)) if len(fs) else np.array([0.0])
    gaps = [(words[i + 1]["s"] - words[i]["e"], words[i]["w"]) for i in range(len(words) - 1)]
    gap, after = max(gaps) if gaps else (0.0, "")
    last = words[-1] if words else None
    end = st[(ts >= last["s"]) & (ts <= last["e"])] if last is not None and len(ts) else np.array([])
    return {"dur": round(len(a) / sr, 2), "pause_ms": int(gap * 1000), "pause_after": after,
            "end_st": round(float(np.median(end)), 1) if len(end) else None,
            "range_st": round(float(np.percentile(st, 95) - np.percentile(st, 5)), 1) if len(st) > 4 else None}


def main(args):
    folder, scene, group = args[0], args[1], int(args[2])
    opt = {a.split("=")[0]: a.split("=", 1)[1] for a in args[3:] if "=" in a}
    root = film_dir(folder)
    script = json.loads((root / "src" / "script.json").read_text(encoding="utf-8-sig"))
    lines = N.lines_of(script)
    idx = next(i for i, l in enumerate(lines) if l["scene"] == scene and l["group"] == group)
    base = dict(lines[idx])
    if "--say" in opt:
        base["say"] = opt["--say"]
    if "--stability" in opt:
        base["stability"] = float(opt["--stability"])
    if "--prev" in opt:
        base["ctxPrev"] = opt["--prev"]
    if "--next" in opt:
        base["ctxNext"] = opt["--next"]
    prev = base.get("ctxPrev", lines[idx - 1]["say"] if idx else "")
    nxt = base.get("ctxNext", lines[idx + 1]["say"] if idx + 1 < len(lines) else "")
    cache = root / "narration" / "cache"
    out = root / "narration" / "variants" / f"{scene}-g{group}"
    out.mkdir(parents=True, exist_ok=True)
    seeds = [int(s) for s in opt.get("--seeds", "11,12,13").split(",")]
    print(f"{scene} g{group}: {base['say']!r}\n  stability {base.get('stability', N.SETTINGS['stability'])}  prev {prev[:70]!r}  next {nxt[:50]!r}")
    for seed in seeds:
        ln = {**base, "seed": seed} if seed != N.SEED else dict(base)
        h = N.take_hash(ln)
        mp3, meta = cache / f"{h}.mp3", cache / f"{h}.json"
        if not (mp3.exists() and meta.exists()):
            audio, align, cost = N.tts(ln["say"], prev, nxt, ln.get("stability"), seed)
            mp3.write_bytes(audio)
            meta.write_text(json.dumps({"say": ln["say"], "alignment": align, "cost": cost}), encoding="utf-8")
        raw = cache / f"{h}.wav"
        if not raw.exists():
            N.decode(mp3, raw)
        a, lo = N.trim(N.read_wav(raw))
        m = json.loads(meta.read_text(encoding="utf-8"))
        words = N.words_from(m.get("alignment"), lo / N.SR, len(a) / N.SR)
        shutil.copy2(mp3, out / f"seed{seed}.mp3")
        p = profile(a, words)
        print(f"  seed {seed:3}  dur {p['dur']:5}s  pause {p['pause_ms']:4} ms after {p['pause_after']!r:16} end {p['end_st']} st  range {p['range_st']} st  -> {h}")
        print("            gaps: " + "  ".join(f"{words[i]['w']}|{int((words[i + 1]['s'] - words[i]['e']) * 1000)}" for i in range(len(words) - 1)))
        ts, fs = f0_track(a, N.SR)
        if len(fs):
            st = 12 * np.log2(fs / np.median(fs))
            pw = [(w["w"], st[(ts >= w["s"]) & (ts <= w["e"])]) for w in words]
            print("            pitch: " + "  ".join(f"{w}|{np.median(v):+.0f}" if len(v) else f"{w}|-" for w, v in pw))


if __name__ == "__main__":
    main(sys.argv[1:])
