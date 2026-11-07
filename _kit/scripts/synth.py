"""Small additive-synthesis kit for the film scores: pads, bells, impacts, air, reverb and mastering.

Import it from a cue-sheet script, place sounds with `sec(scene, frame)`, then call `master()`.
Timing comes from src/timing.json so every cue stays locked to the picture.
"""
import json
from pathlib import Path

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, fftconvolve, sosfilt

ROOT = Path(__file__).resolve().parent.parent
timing = json.loads((ROOT / "src" / "timing.json").read_text(encoding="utf-8"))
FPS, OV, CUES = timing["fps"], timing["overlap"], timing.get("cues", {})
SR = 48000
rng = np.random.default_rng(17)

starts, _t = {}, 0
for _s in timing["scenes"]:
    starts[_s["id"]] = _t
    _t += _s["duration"] - OV
TOTAL = timing["scenes"][-1]["duration"] + starts[timing["scenes"][-1]["id"]]
T = TOTAL / FPS
N = int(T * SR)

pad = np.zeros((2, N))
fx = np.zeros((2, N))


def sec(scene, local=0.0):
    return (starts[scene] + local) / FPS


def hz(note):
    return 440.0 * 2 ** ((note - 69) / 12)


def place(bus, start, sig, pan=0.0):
    i0 = int(start * SR)
    if i0 >= N:
        return
    if i0 < 0:
        sig, i0 = sig[-i0:], 0
    sig = sig[: N - i0]
    ang = (pan + 1) * np.pi / 4
    bus[0, i0 : i0 + len(sig)] += sig * np.cos(ang)
    bus[1, i0 : i0 + len(sig)] += sig * np.sin(ang)


def raised(x):
    return 0.5 - 0.5 * np.cos(np.pi * np.clip(x, 0, 1))


def pad_note(note, t0, t1, gain, attack, release, bright):
    n = int((t1 - t0 + release) * SR)
    t = np.arange(n) / SR
    f = hz(note)
    harmonics = [1.0, 0.45 * bright, 0.22 * bright, 0.11 * bright, 0.05 * bright]
    if note < 45:
        harmonics = harmonics[:3]
    sig = np.zeros(n)
    for k, a in enumerate(harmonics, start=1):
        for det in (-0.0023, 0.0023):
            sig += a * np.sin(2 * np.pi * f * k * (1 + det) * t + rng.random() * 6.28)
    lfo = 1 + 0.1 * np.sin(2 * np.pi * (0.08 + 0.1 * rng.random()) * t + rng.random() * 6.28)
    env = raised(t / attack) * (1 - raised((t - (t1 - t0)) / release))
    place(pad, t0, sig * env * lfo * gain * (1.25 if note < 45 else 1.0), pan=rng.uniform(-0.5, 0.5))


def chord(t0, t1, notes, gain=1.0, attack=2.2, release=3.0, bright=1.0):
    for n in notes:
        pad_note(n, t0, t1, 0.03 * gain, attack, release, bright)


def bell(note, t0, gain=0.5, decay=3.2, pan=None):
    n = int(decay * 2.2 * SR)
    t = np.arange(n) / SR
    f = hz(note)
    sig = np.zeros(n)
    for ratio, a, d in [(1, 1, 1), (2.0, 0.45, 0.6), (2.76, 0.3, 0.45), (4.07, 0.16, 0.3), (5.4, 0.08, 0.22)]:
        sig += a * np.sin(2 * np.pi * f * ratio * t) * np.exp(-t / (decay * d))
    sig *= np.clip(t / 0.004, 0, 1)
    place(pad, t0, sig * 0.05 * gain, pan=rng.uniform(-0.7, 0.7) if pan is None else pan)


def sparkle(t0, t1, count, gain=0.25, scale=(79, 83, 86, 88, 91, 95)):
    for tt in np.sort(rng.uniform(t0, t1, count)):
        bell(int(rng.choice(scale)), tt, gain * rng.uniform(0.5, 1), decay=rng.uniform(1.2, 2.4))


def plink(note, t0, gain=0.5):
    bell(note, t0, gain, decay=0.9)


def filtered_noise(n, lo, hi):
    return sosfilt(butter(2, [lo, hi], btype="band", fs=SR, output="sos"), rng.standard_normal(n))


def boom(t0, gain=1.0):
    n = int(3.5 * SR)
    t = np.arange(n) / SR
    freq = 36 + 60 * np.exp(-t * 14)
    sub = np.sin(2 * np.pi * np.cumsum(freq) / SR) * np.exp(-t / 1.1)
    body = sosfilt(butter(2, 180, fs=SR, output="sos"), rng.standard_normal(n)) * np.exp(-t / 0.22) * 2.2
    click = rng.standard_normal(n) * np.exp(-t / 0.004) * 0.25
    place(fx, t0, (sub + body + click) * 0.55 * gain)


def heartbeat(t0, gain=0.3):
    boom(t0, gain)
    boom(t0 + 0.2, gain * 0.7)


def crack(t0, gain=0.5):
    n = int(0.9 * SR)
    t = np.arange(n) / SR
    snap = filtered_noise(n, 2500, 14000) * np.exp(-t / 0.05)
    ring = np.sin(2 * np.pi * 3100 * t) * np.exp(-t / 0.25) * 0.15
    place(fx, t0, (snap + ring) * 0.5 * gain, pan=rng.uniform(-0.3, 0.3))


def thunder(t0, gain=1.0):
    boom(t0, gain)
    n = int(4 * SR)
    t = np.arange(n) / SR
    roll = sosfilt(butter(2, 400, fs=SR, output="sos"), rng.standard_normal(n)) * np.exp(-t / 1.2) * (0.6 + 0.4 * np.sin(t * 7))
    place(fx, t0 + 0.05, roll * 1.2 * gain)
    crack(t0, gain * 0.6)


def swell(t0, t1, gain=0.5, lo=400, hi=5000):
    n = int((t1 - t0) * SR)
    t = np.arange(n) / SR
    env = (t / (t1 - t0)) ** 3 * np.clip((n - np.arange(n)) / (0.02 * SR), 0, 1)
    place(fx, t0, filtered_noise(n, lo, hi) * env * 0.35 * gain)


def riser(t0, t1, gain=0.6, down=False):
    n = int((t1 - t0) * SR)
    t = np.arange(n) / SR
    p = t / (t1 - t0)
    freq = 110 * 2 ** ((1 - p if down else p) * 3)
    tone = np.sin(2 * np.pi * np.cumsum(freq) / SR) + 0.5 * np.sin(2 * np.pi * np.cumsum(freq * 1.5) / SR)
    env = (np.sin(np.pi * p) if down else p**2.5) * np.clip((n - np.arange(n)) / (0.015 * SR), 0, 1)
    place(fx, t0, (tone * 0.08 + filtered_noise(n, 800, 8000) * 0.25 * p) * env * gain)


def rumble(t0, t1, gain=0.5):
    n = int((t1 - t0) * SR)
    p = np.arange(n) / n
    sig = sosfilt(butter(2, 120, fs=SR, output="sos"), rng.standard_normal(n)) * p**1.5 * np.clip((n - np.arange(n)) / (0.03 * SR), 0, 1)
    place(fx, t0, sig * 1.6 * gain)


def wind(t0, t1, gain=0.5):
    n = int((t1 - t0) * SR)
    t = np.arange(n) / SR
    mod = sosfilt(butter(1, 0.6, fs=SR, output="sos"), rng.standard_normal(n))
    mod = 0.6 + 0.4 * mod / (np.abs(mod).max() + 1e-9)
    p = t / (t1 - t0)
    env = raised(t / 0.8) * (1 - raised((p - 0.8) / 0.2))
    for lo, hi, a, pan in [(250, 1200, 0.5, -0.4), (1200, 5000, 0.28, 0.4)]:
        place(fx, t0, filtered_noise(n, lo, hi) * mod * env * a * gain, pan=pan)


def water(t0, t1, gain=0.3):
    """Gentle lapping water: band-limited noise with slow random swells."""
    n = int((t1 - t0) * SR)
    t = np.arange(n) / SR
    mod = sosfilt(butter(1, 1.2, fs=SR, output="sos"), rng.standard_normal(n))
    mod = 0.5 + 0.5 * np.clip(mod / (np.abs(mod).max() + 1e-9) * 2, -1, 1)
    env = raised(t / 1.0) * (1 - raised((t - (t1 - t0 - 1.0)) / 1.0))
    place(fx, t0, filtered_noise(n, 300, 2400) * mod * env * 0.35 * gain)


def ignite(t0, gain=0.3):
    n = int(0.5 * SR)
    t = np.arange(n) / SR
    sig = filtered_noise(n, 200, 2500) * np.clip(t / 0.03, 0, 1) * np.exp(-t / 0.12)
    place(fx, t0, sig * gain, pan=rng.uniform(-0.6, 0.6))


def chirp(t0, gain=0.2):
    """A small bird call: two quick downward-gliding sine blips."""
    for k in range(2):
        n = int(0.09 * SR)
        t = np.arange(n) / SR
        f = rng.uniform(3200, 4800) * (1 - 2.2 * t)
        sig = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t / t[-1])
        place(fx, t0 + k * 0.12, sig * 0.12 * gain, pan=rng.uniform(-0.8, 0.8))


def whale(t0, gain=0.4, dur=3.0):
    """Low gliding moan in the style of a whale song."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = 140 + 90 * np.sin(np.pi * t / dur) - 40 * t / dur
    sig = np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.3 * np.sin(4 * np.pi * np.cumsum(f) / SR)
    env = np.sin(np.pi * t / dur) ** 2
    place(pad, t0, sig * env * 0.06 * gain, pan=rng.uniform(-0.4, 0.4))


def hammer(t0, t1, every=0.55, gain=0.35):
    """Wooden knocks (building the ark, laying bricks)."""
    t = t0
    while t < t1:
        n = int(0.25 * SR)
        tt = np.arange(n) / SR
        knock = filtered_noise(n, 300, 2200) * np.exp(-tt / 0.03) + np.sin(2 * np.pi * rng.uniform(180, 260) * tt) * np.exp(-tt / 0.06) * 0.6
        place(fx, t, knock * 0.5 * gain * rng.uniform(0.6, 1), pan=rng.uniform(-0.6, 0.6))
        t += every * rng.uniform(0.8, 1.3)


def rain(t0, t1, gain=0.4):
    """Steady rain: bright hiss with slow swells."""
    n = int((t1 - t0) * SR)
    t = np.arange(n) / SR
    mod = sosfilt(butter(1, 0.3, fs=SR, output="sos"), rng.standard_normal(n))
    mod = 0.7 + 0.3 * mod / (np.abs(mod).max() + 1e-9)
    env = raised(t / 1.5) * (1 - raised((t - (t1 - t0 - 1.5)) / 1.5))
    for lo, hi, a, pan in [(1500, 9000, 0.5, -0.5), (900, 6000, 0.45, 0.5)]:
        place(fx, t0, filtered_noise(n, lo, hi) * mod * env * a * gain, pan=pan)


def crackle(t0, t1, gain=0.3, rate=9):
    """Fire crackle: random small snaps over a soft roar."""
    n = int((t1 - t0) * SR)
    t = np.arange(n) / SR
    env = raised(t / 0.6) * (1 - raised((t - (t1 - t0 - 0.6)) / 0.6))
    place(fx, t0, filtered_noise(n, 150, 900) * env * 0.25 * gain)
    for tt in np.sort(rng.uniform(t0, t1, int((t1 - t0) * rate))):
        m = int(0.05 * SR)
        k = np.arange(m) / SR
        place(fx, tt, filtered_noise(m, 1500, 8000) * np.exp(-k / 0.008) * 0.5 * gain * rng.uniform(0.3, 1), pan=rng.uniform(-0.5, 0.5))


def horn(t0, gain=0.5, voices=1, dur=1.8):
    """Ram's horn (shofar) blast: a brassy tone that leaps up a fifth and holds. `voices` > 1 makes a massed call."""
    for v in range(voices):
        d = dur * (rng.uniform(0.85, 1.15) if voices > 1 else 1)
        n = int(d * SR)
        t = np.arange(n) / SR
        f0 = hz(52 + (int(rng.integers(-3, 4)) if voices > 1 else 0))
        freq = f0 * (1 + 0.5 * raised(t / 0.14)) * (1 + 0.006 * np.sin(2 * np.pi * 5.2 * t + rng.random() * 6.28)) * (1 + 0.03 * np.clip((t - d + 0.3) / 0.3, 0, 1))
        ph = 2 * np.pi * np.cumsum(freq) / SR
        sig = sum((1 / k**0.9) * np.sin(k * ph) for k in range(1, 9))
        env = np.clip(t / 0.05, 0, 1) * (1 - raised((t - (d - 0.3)) / 0.3))
        breath = filtered_noise(n, 900, 3500) * 0.15
        lag = rng.uniform(0, 0.25) if voices > 1 else 0
        place(fx, t0 + lag, (sig * 0.05 + breath * 0.05) * env * gain / np.sqrt(voices), pan=rng.uniform(-0.7, 0.7) if voices > 1 else 0)


def whoosh(t0, gain=0.4, dur=1.2):
    n = int(dur * SR)
    t = np.arange(n) / SR
    env = np.sin(np.pi * t / dur) ** 2
    place(fx, t0, filtered_noise(n, 400, 4000) * env * 0.4 * gain, pan=rng.uniform(-0.3, 0.3))


def reverb_ir(seconds, lowpass):
    n = int(seconds * SR)
    t = np.arange(n) / SR
    env = np.exp(-t * 6.9 / seconds)
    ir = np.stack([rng.standard_normal(n), rng.standard_normal(n)]) * env
    ir = sosfilt(butter(2, lowpass, fs=SR, output="sos"), ir)
    ir = np.pad(ir, ((0, 0), (int(0.025 * SR), 0)))
    return ir / np.sqrt((ir**2).sum(axis=1, keepdims=True))


def master(name="score.wav"):
    ir = reverb_ir(5.0, 5500)
    wet_pad = np.stack([fftconvolve(pad[c], ir[c])[:N] for c in range(2)])
    wet_fx = np.stack([fftconvolve(fx[c], ir[c])[:N] for c in range(2)])
    mix = 0.7 * pad + 0.9 * wet_pad * 2.2 + 0.85 * fx + 0.35 * wet_fx * 2.2
    mix = sosfilt(butter(2, 28, btype="high", fs=SR, output="sos"), mix)
    fade = np.ones(N)
    tail = int(2.4 * SR)
    fade[-tail:] = np.linspace(1, 0, tail) ** 2
    mix *= fade
    mix = np.tanh(mix / (np.abs(mix).max() + 1e-9) * 1.6) / np.tanh(1.6)
    mix *= 0.89 / (np.abs(mix).max() + 1e-9)
    out = ROOT / "public" / name
    wavfile.write(out, SR, (mix.T * 32767).astype(np.int16))
    print(f"wrote {out}  {T:.2f}s  peak {np.abs(mix).max():.3f}")
