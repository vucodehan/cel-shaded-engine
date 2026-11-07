"""Per-scene RMS / peak of public/score.wav, to sanity-check the mix balance."""
import json
from pathlib import Path

import numpy as np
from scipy.io import wavfile

ROOT = Path(__file__).resolve().parent.parent
sr, a = wavfile.read(ROOT / "public" / "score.wav")
mono = a.astype(float).mean(axis=1) / 32767
timing = json.loads((ROOT / "src" / "timing.json").read_text(encoding="utf-8"))
start = 0
for s in timing["scenes"]:
    seg = mono[int(start / 30 * sr) : int((start + s["duration"]) / 30 * sr)]
    rms = 20 * np.log10(np.sqrt((seg**2).mean()) + 1e-9)
    peak = 20 * np.log10(np.abs(seg).max() + 1e-9)
    print(f"{s['id']:<13} rms {rms:6.1f} dBFS   peak {peak:6.1f} dBFS")
    start += s["duration"] - timing["overlap"]
