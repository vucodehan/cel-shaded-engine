"""Flint narration for one film: python narrate.py <folder>

Reads <folder>/src/script.json. One take per text group (plus the spoken title), Eleven v4, Max Robust.
Uses the /with-timestamps endpoint so every word has a start/end time (vertical subtitles, mix checks).
Takes are cached by text in narration/cache/<hash>.{mp3,json}; re-running never re-bills unchanged lines.
Writes narration/lines/NN.wav (mono 44.1 kHz, trimmed, faded, trailing breaths cut) and narration/lines.json.
Reads ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID from the environment and never writes the key anywhere.
"""
import base64
import hashlib
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request
import wave
from pathlib import Path

import numpy as np

from films import film_dir  # noqa: E402
VOICE = os.environ.get("ELEVENLABS_VOICE_ID", "")
MODEL = "eleven_v4"
SEED = 4217
SR = 44100
SETTINGS = {"stability": 1.0, "similarity_boost": 1.0, "style": 0.0, "use_speaker_boost": True, "speed": 1.0}


def say_text(t: str) -> str:
    s = " ".join(t.replace("\n", " ").split())
    return s.replace("LORD", "Lord")


# Per-group delivery overrides in script.json (all optional, part of the take's cache key only when present):
#   ctxPrev / ctxNext  unspoken context sent as previous_text / next_text instead of the neighbouring lines; steers
#                      the tone ("And now, the title of this film:" before a title makes it an announcement)
#   stability          0.5 (natural, more expressive) instead of 1.0 (robust, even) for a line that needs feeling
#   seed               another take of the same text and settings (vo_variants.py tries several)
OVERRIDES = ("ctxPrev", "ctxNext", "stability", "seed")


def lines_of(script: dict):
    out = []
    for s in script["scenes"]:
        for gi, g in enumerate(s.get("groups", [])):
            if g.get("silent"):
                continue
            ln = {"scene": s["id"], "group": gi, "text": " ".join(g["t"].split()), "say": g.get("say") or say_text(g["t"])}
            ln.update({k: g[k] for k in OVERRIDES if g.get(k) is not None})
            out.append(ln)
    return out


def take_hash(ln: dict) -> str:
    extra = {k: ln[k] for k in OVERRIDES if ln.get(k) is not None}
    key = [ln["say"], MODEL, VOICE, SETTINGS, SEED] + ([extra] if extra else [])
    return hashlib.sha1(json.dumps(key).encode("utf-8")).hexdigest()[:16]


def tts(text: str, prev: str, nxt: str, stability=None, seed=None):
    key = os.environ["ELEVENLABS_API_KEY"]
    if not VOICE:
        raise SystemExit("ELEVENLABS_VOICE_ID is not set")
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE}/with-timestamps?output_format=mp3_44100_128"
    settings = {**SETTINGS, **({"stability": stability} if stability is not None else {})}
    body = {"text": text, "model_id": MODEL, "language_code": "en", "seed": SEED if seed is None else seed, "apply_text_normalization": "auto", "voice_settings": settings}
    if prev:
        body["previous_text"] = prev
    if nxt:
        body["next_text"] = nxt
    data = json.dumps(body).encode("utf-8")
    last = None
    for attempt in range(6):
        req = urllib.request.Request(url, data=data, headers={"xi-api-key": key, "Content-Type": "application/json", "Accept": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=240) as res:
                cost = res.headers.get("character-cost")
                payload = json.loads(res.read().decode("utf-8"))
                return base64.b64decode(payload["audio_base64"]), payload.get("alignment") or payload.get("normalized_alignment"), int(cost) if cost else None
        except urllib.error.HTTPError as e:
            detail = e.read().decode("utf-8", "replace")[:600]
            last = f"HTTP {e.code}: {detail}"
            if e.code == 429 or e.code >= 500:
                time.sleep(max(int(e.headers.get("Retry-After", "4")), 3 + attempt * 3))
                continue
            raise RuntimeError(last) from e
        except (urllib.error.URLError, TimeoutError) as e:
            last = str(e)
            time.sleep(4 + attempt * 3)
    raise RuntimeError(last or "TTS failed")


def decode(mp3: Path, wav: Path):
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(mp3), "-ac", "1", "-ar", str(SR), "-c:a", "pcm_s16le", str(wav)], check=True)


def read_wav(p: Path) -> np.ndarray:
    with wave.open(str(p)) as w:
        a = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32)
    return a


def write_wav(p: Path, a: np.ndarray):
    p.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(p), "w") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(np.clip(a, -32767, 32767).astype(np.int16).tobytes())


def voicing(seg: np.ndarray) -> float:
    lo, hi, win = SR // 400, SR // 70, 1024
    peaks = []
    for k in range(0, len(seg) - win, SR // 100):
        x = seg[k : k + win] - seg[k : k + win].mean()
        ac = np.correlate(x, x, "full")[win - 1 :]
        if ac[0] > 0:
            peaks.append(ac[lo:hi].max() / ac[0])
    return float(np.median(peaks)) if peaks else 0.0


def breath_cut(a: np.ndarray, hi: int):
    """Where to end the take when a[:hi] closes with a breath or a click after the last word, else None.

    The final segment after a pause of at least 100 ms (10 ms frames under -70 dBFS) is dropped when it is far
    quieter than the speech, noise-like, or a short blip after a long pause. ElevenLabs stretches the last word's
    timestamp to the end of the file, so only the audio can tell. Plosive releases ("Egypt", "ark") follow
    closures of 40-70 ms, which is why shorter pauses never count.
    """
    hop = SR // 100
    n = hi // hop
    if n < 20:
        return None
    db = 20 * np.log10(np.sqrt((a[: n * hop].astype(np.float64).reshape(n, hop) ** 2).mean(axis=1)) / 32768 + 1e-9)
    if not (db > -50).any():
        return None
    ref = np.percentile(db[db > -50], 90)
    quiet = db < -70
    live = np.nonzero(~quiet)[0]
    if not len(live):
        return None
    last, seg0, run = live[-1], None, 0
    for k in range(last, -1, -1):
        run = run + 1 if quiet[k] else 0
        if run == 4:
            seg0 = k + 4
            break
    if seg0 is None:
        return None
    gap0 = seg0
    while gap0 > 0 and quiet[gap0 - 1]:
        gap0 -= 1
    gap_ms, seg_ms = (seg0 - gap0) * 10, (last + 1 - seg0) * 10
    if gap0 == 0 or gap_ms < 100:
        return None
    peak = db[seg0 : last + 1].max() - ref
    seg = a[seg0 * hop : (last + 1) * hop].astype(np.float64)
    spec = np.abs(np.fft.rfft(seg * np.hanning(len(seg)))) ** 2
    centroid = (spec * np.fft.rfftfreq(len(seg), 1 / SR)).sum() / (spec.sum() + 1e-12)
    blip = gap_ms >= 300 and seg_ms <= 150
    soft = peak <= -12 and seg_ms <= 800
    noisy = seg_ms <= 450 and peak <= -8.5 and centroid >= 1400 and voicing(seg) <= 0.3
    return gap0 * hop + int(0.06 * SR) if blip or soft or noisy else None


def trim(a: np.ndarray, thresh=450.0):
    idx = np.nonzero(np.abs(a) > thresh)[0]
    if len(idx) == 0:
        return a, 0
    lo = max(0, idx[0] - int(0.02 * SR))
    hi = min(len(a), idx[-1] + 1 + int(0.08 * SR))
    for _ in range(3):
        cut = breath_cut(a, hi)
        if cut is None or cut >= hi:
            break
        hi = cut
    out = a[lo:hi].copy()
    fi, fo = min(len(out) // 4, int(0.02 * SR)), min(len(out) // 4, int(0.06 * SR))
    out[:fi] *= np.linspace(0, 1, fi)
    out[-fo:] *= np.linspace(1, 0, fo)
    return out, lo


def words_from(alignment, offset_s: float, dur: float):
    if not alignment:
        return []
    chars = alignment["characters"]
    st = alignment["character_start_times_seconds"]
    en = alignment["character_end_times_seconds"]
    words, cur, s0, e0 = [], "", None, None
    for c, a, b in zip(chars, st, en):
        if c.isspace():
            if cur:
                words.append({"w": cur, "s": round(max(0, s0 - offset_s), 3), "e": round(min(dur, e0 - offset_s), 3)})
            cur, s0 = "", None
            continue
        if s0 is None:
            s0 = a
        cur += c
        e0 = b
    if cur:
        words.append({"w": cur, "s": round(max(0, s0 - offset_s), 3), "e": round(min(dur, e0 - offset_s), 3)})
    return words


def main(folder: str):
    root = film_dir(folder)
    script = json.loads((root / "src" / "script.json").read_text(encoding="utf-8-sig"))
    lines = lines_of(script)
    cache = root / "narration" / "cache"
    cache.mkdir(parents=True, exist_ok=True)
    out_dir = root / "narration" / "lines"
    out_dir.mkdir(parents=True, exist_ok=True)
    for old in out_dir.glob("*.wav"):
        old.unlink()
    bill_p = root / "narration" / "billing.json"
    bill = json.loads(bill_p.read_text(encoding="utf-8")) if bill_p.exists() else {"requests": 0, "credits": 0, "characters": 0}
    total_chars = sum(len(l["say"]) for l in lines)
    print(f"{folder}: {len(lines)} lines, {total_chars} characters", flush=True)
    result = []
    for i, ln in enumerate(lines):
        h = take_hash(ln)
        mp3, meta = cache / f"{h}.mp3", cache / f"{h}.json"
        if not (mp3.exists() and meta.exists()):
            prev = ln.get("ctxPrev", lines[i - 1]["say"] if i else "")
            nxt = ln.get("ctxNext", lines[i + 1]["say"] if i + 1 < len(lines) else "")
            audio, align, cost = tts(ln["say"], prev, nxt, ln.get("stability"), ln.get("seed"))
            mp3.write_bytes(audio)
            meta.write_text(json.dumps({"say": ln["say"], "alignment": align, "cost": cost}), encoding="utf-8")
            bill["requests"] += 1
            bill["credits"] += cost or 0
            bill["characters"] += len(ln["say"])
            bill_p.write_text(json.dumps(bill, indent=2), encoding="utf-8")
            print(f"  [{i:02d}] tts {len(ln['say'])} chars, cost {cost}: {ln['say'][:70]}", flush=True)
            time.sleep(0.25)
        m = json.loads(meta.read_text(encoding="utf-8"))
        raw = cache / f"{h}.wav"
        if not raw.exists():
            decode(mp3, raw)
        a, lo = trim(read_wav(raw))
        dur = len(a) / SR
        wav = out_dir / f"{i:02d}.wav"
        write_wav(wav, a)
        result.append({**{k: v for k, v in ln.items() if k not in OVERRIDES}, "i": i, "dur": round(dur, 3), "file": str(wav), "hash": h, "words": words_from(m.get("alignment"), lo / SR, dur)})
    (root / "narration" / "lines.json").write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"wrote {len(result)} lines; billing so far {bill}", flush=True)


if __name__ == "__main__":
    main(sys.argv[1])
