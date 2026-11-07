"""Narrated soundtrack for one film: python mix.py <folder>

Score (public/score.wav) ducked under the dry Flint takes (narration/cues.json), soft-limited -> out/_narrated.wav.
The voice is the plain take, no reverb or delay, matching the Resolve voice track (A4).
The score is then lowered 18 dB, the same move as the Resolve A1 fader from -3 dB to -21 dB, so the
music sits under the voice instead of competing with it. The voice gain is measured against the
unattenuated score, and the 18 dB comes off afterwards, so the limiter does not put the music back.
"""
import json
import sys
import wave
from pathlib import Path

import numpy as np
from scipy.io import wavfile
from scipy.signal import resample_poly

from films import film_dir, take
SR = 48000
# Resolve A1 was -3 dB and is now -21 dB. Applied after the voice is leveled, not before.
SCORE_FADER_DB = -18.0


def read_mono(p):
    with wave.open(str(p)) as w:
        a = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float64) / 32768
        sr = w.getframerate()
    return resample_poly(a, 160, 147) if sr == 44100 else a


def env_follow(x, attack=0.02, release=0.45, rate=1000):
    step = SR // rate
    n = len(x) // step + 1
    pad = np.pad(np.abs(x), (0, n * step - len(x)))
    e = pad.reshape(n, step).max(axis=1)
    out = np.zeros(n)
    a = np.exp(-1 / (attack * rate))
    r = np.exp(-1 / (release * rate))
    v = 0.0
    for i, s in enumerate(e):
        v = a * v + (1 - a) * s if s > v else r * v + (1 - r) * s
        out[i] = v
    return np.interp(np.arange(len(x)), np.arange(n) * step, out)


def main(folder: str):
    root = film_dir(folder)
    sr, score = wavfile.read(root / "public" / "score.wav")
    score = score.astype(np.float64) / 32768
    if score.ndim == 1:
        score = np.stack([score, score], axis=1)
    N = len(score)
    cues = json.loads((root / "narration" / "cues.json").read_text(encoding="utf-8"))["clips"]
    vo = np.zeros(N)
    for c in cues:
        a = read_mono(take(root, c))
        i0 = int(round(c["frame"] / 30 * SR))
        a = a[: max(0, N - i0)]
        vo[i0 : i0 + len(a)] += a
    speech = np.abs(vo) > 0.01
    sp_rms = np.sqrt((vo[speech] ** 2).mean()) if speech.any() else 0.1
    sc_rms = np.sqrt((score**2).mean())
    gain = (sc_rms * 10 ** (9.5 / 20)) / sp_rms
    vo *= gain
    env = env_follow(vo)
    duck = 1 - 0.58 * np.clip(env / (np.percentile(env[speech], 90) + 1e-9 if speech.any() else 1), 0, 1)
    bed = score * (10 ** (SCORE_FADER_DB / 20))
    mix = bed * duck[:, None] + vo[:, None]
    mix = np.tanh(mix / (np.abs(mix).max() + 1e-9) * 1.4) / np.tanh(1.4)
    mix *= 0.89 / (np.abs(mix).max() + 1e-9)
    out = root / "out" / "_narrated.wav"
    wavfile.write(out, SR, (mix * 32767).astype(np.int16))
    print(f"wrote {out}: {N / SR:.2f}s, voice gain {20 * np.log10(gain):+.1f} dB, score {SCORE_FADER_DB:+.0f} dB, {len(cues)} takes")


if __name__ == "__main__":
    main(sys.argv[1])
