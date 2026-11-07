"""Score from the scene moods and sound-effect tags in src/timing.json -> public/score.wav.

Each scene carries "mood" (a chord progression, spread across the scene) and optional "sfx" tags:
  "wind" | "water" | "rain" | "chirp" | "fire"          whole scene
  "thunder@g1+20" | "boom@60" | "heartbeat@g0" | "bells@g2" | "crack@end-30" | "whoosh@g1" | "horn@g0" | "horns@g1"   instants
  "riser@g1-60>g1" | "swell@40>120" | "rumble@g0>g2" | "sparkle@g1>end" | "hammer@g0>end" | "rain@0>g2"   ranges
Times: a frame number, "gN" (+/- offset) for a text group's start, or "end" (+/- offset).
"key" at the top level transposes the whole film (semitones from D).
"""
import json
import re

from synth import ROOT, T, bell, boom, chirp, chord, crack, crackle, hammer, heartbeat, horn, master, rain, riser, rumble, sec as S, sparkle, swell, water, whoosh, wind

timing = json.loads((ROOT / "src" / "timing.json").read_text(encoding="utf-8"))
KEY = int(timing.get("key", 0))
FPS = timing["fps"]

D = [38, 45, 50, 54, 57, 62]
Dsus = [38, 45, 50, 52, 57, 64]
G = [43, 50, 55, 59, 62, 67]
Gmaj7 = [43, 50, 54, 59, 62]
A = [45, 52, 57, 61, 64]
Asus = [45, 52, 57, 62, 64]
Bm = [47, 54, 59, 62, 66]
Bm9 = [47, 54, 59, 61, 62, 66]
Em = [40, 52, 55, 59, 62]
Fsm = [42, 49, 54, 57, 61]
Fs = [42, 49, 54, 58, 61]
Dm = [38, 45, 50, 53, 57, 62]
Bb = [46, 53, 58, 62, 65]
Gm = [43, 50, 55, 58, 62]
C = [48, 55, 60, 64, 67]
Eb = [39, 51, 55, 58, 63]
F = [41, 48, 53, 57, 60]

MOODS = {
    "title": ([Dsus, D], 0.85, 0.7),
    "pastoral": ([D, G, D, A], 0.9, 0.9),
    "calm": ([D, Bm, G, A], 0.85, 0.85),
    "wonder": ([Dsus, Fsm, G, D], 0.9, 1.0),
    "promise": ([G, D, Em, A, D], 0.95, 1.0),
    "tense": ([Bm, G, Em, Fs], 0.8, 0.7),
    "dark": ([Dm, Bb, Gm, A], 0.8, 0.65),
    "grief": ([Bm, Em, Bm, Fs], 0.75, 0.6),
    "storm": ([Dm, Bb, Dm, A], 0.85, 0.6),
    "night": ([Bm9, Gmaj7, Em, Asus], 0.75, 0.75),
    "joy": ([G, D, A, D], 0.95, 1.1),
    "solemn": ([D, G, D, A], 0.85, 0.8),
    "hope": ([G, A, Fsm, Bm, G, A, D], 0.9, 1.0),
    "divine": ([Dsus, G, D], 1.0, 1.2),
    "egypt": ([Dm, Eb, Dm, C], 0.85, 0.85),
    "end": ([G, D], 0.95, 1.0),
}

ids = [s["id"] for s in timing["scenes"]]
DUR = {s["id"]: s["duration"] for s in timing["scenes"]}


def tr(notes):
    return [n + KEY for n in notes]


def at(scene, expr):
    s = next(x for x in timing["scenes"] if x["id"] == scene)
    expr = expr.strip()
    m = re.fullmatch(r"(g(\d+)|end)?\s*([+-]\s*\d+)?", expr)
    if expr.lstrip("-").isdigit():
        return S(scene, int(expr))
    if not m:
        raise ValueError(f"bad time {expr!r} in {scene}")
    base = 0
    if m.group(1) == "end":
        base = s["duration"]
    elif m.group(2) is not None:
        base = s["groups"][int(m.group(2))]["at"]
    off = int(m.group(3).replace(" ", "")) if m.group(3) else 0
    return S(scene, base + off)


for idx, s in enumerate(timing["scenes"]):
    sid = s["id"]
    dur = s["duration"]
    mood = s.get("mood", "title" if s.get("kind") == "title" else "end" if s.get("kind") == "end" else "calm")
    chords, gain, bright = MOODS[mood]
    n = max(1, min(len(chords), int(dur / FPS // 3.6)))
    seg = dur / n
    for k in range(n):
        end = (k + 1) * seg + (4 if k < n - 1 else 18)
        chord(S(sid, k * seg), S(sid, end), tr(chords[k]), gain=gain, attack=1.6 if k else 2.0, release=2.6, bright=bright)
    if s.get("kind") == "title":
        bell(74 + KEY, S(sid, 20), 0.45)
        bell(81 + KEY, S(sid, 72), 0.35)
        swell(S(sid, 10), S(sid, 70), 0.2, 300, 3000)
    elif s.get("kind") == "end":
        bell(74 + KEY, S(sid, 16), 0.4)
        bell(86 + KEY, S(sid, 60), 0.3)
    elif s.get("groups"):
        bell([74, 76, 78, 81, 83][idx % 5] + KEY, S(sid, s["groups"][0]["at"]), 0.22)
    for tag in s.get("sfx", []):
        name, _, when = tag.partition("@")
        if not when:
            t0, t1 = S(sid, 0), S(sid, dur)
        elif ">" in when:
            a, b = when.split(">")
            t0, t1 = at(sid, a), at(sid, b)
        else:
            t0 = t1 = at(sid, when)
        if name == "wind":
            wind(t0, max(t1, t0 + 2), 0.35)
        elif name == "water":
            water(t0, max(t1, t0 + 2), 0.45)
        elif name == "rain":
            rain(t0, max(t1, t0 + 2), 0.45)
        elif name == "chirp":
            tt = t0 + 0.5
            while tt < t1 - 0.5:
                chirp(tt, 0.4)
                tt += 1.1
        elif name == "fire":
            crackle(t0, max(t1, t0 + 1.5), 0.35)
        elif name == "thunder":
            from synth import thunder

            thunder(t0, 0.9)
        elif name == "boom":
            boom(t0, 0.8)
        elif name == "heartbeat":
            heartbeat(t0, 0.35)
        elif name == "bells":
            for kk, nn in enumerate([81, 86, 90]):
                bell(nn + KEY, t0 + kk * 0.09, 0.42)
        elif name == "crack":
            crack(t0, 0.5)
        elif name == "whoosh":
            whoosh(t0, 0.45)
        elif name == "riser":
            riser(t0, t1, 0.55)
        elif name == "swell":
            swell(t0, t1, 0.3, 300, 3500)
        elif name == "rumble":
            rumble(t0, t1, 0.5)
        elif name == "sparkle":
            sparkle(t0, t1, max(4, int((t1 - t0) * 2.2)), 0.13)
        elif name == "hammer":
            hammer(t0, t1, 0.6, 0.3)
        elif name == "horn":
            horn(t0, 0.7)
        elif name == "horns":
            horn(t0, 1.1, voices=10)
        else:
            raise ValueError(f"unknown sfx {name!r} in {sid}")

master()
