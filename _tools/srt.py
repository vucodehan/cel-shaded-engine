"""Subtitles for one film: python srt.py <folder>

Exactly two files (the delivery standard, Oct 12 2026):
16:9  -> out/<folder>-master-narrated.en_US.srt: up to 2 lines of 42 characters per cue (for youtube-narrated).
9:16  -> out/<folder>-vertical-master-narrated.en_US.srt: one line of at most 15 characters (for vertical-narrated
         and, shifted by each Short's start, the Shorts).
Cue times come from the ElevenLabs word timestamps of each voice take, offset by the take's frame.
"""
import json
import re
import sys
from pathlib import Path

from films import SRT, film_dir
FPS = 30
LAND = ("master-narrated",)
PORT = ("vertical-master-narrated",)
BREAK = re.compile(r"[,;:.!?—”]$")


def stamp(sec: float) -> str:
    ms = max(0, round(sec * 1000))
    h, ms = divmod(ms, 3_600_000)
    m, ms = divmod(ms, 60_000)
    s, ms = divmod(ms, 1000)
    return f"{h:02}:{m:02}:{s:02},{ms:03}"


def timed_words(clip):
    disp = clip["text"].split()
    said = clip.get("words") or []
    t0 = clip["frame"] / FPS
    if said and len(said) == len(disp):
        return [(w, t0 + a["s"], t0 + a["e"]) for w, a in zip(disp, said)]
    s0 = said[0]["s"] if said else 0.0
    e0 = said[-1]["e"] if said else clip["dur"]
    total = sum(len(w) + 1 for w in disp)
    out, acc = [], 0
    for w in disp:
        a = s0 + (e0 - s0) * acc / total
        acc += len(w) + 1
        out.append((w, t0 + a, t0 + s0 + (e0 - s0) * acc / total))
    return out


def hyphenate(w, limit):
    """Split a word with no hyphen or dash (Nebuchadnezzar’s) near its middle, between two consonants if possible."""
    vowel = set("aeiouyAEIOUY")
    cuts = [i for i in range(2, len(w) - 1) if w[i - 1].isalpha() and w[i].isalpha() and i + 1 <= limit and len(w) - i <= limit]
    pair = [i for i in cuts if w[i - 1] not in vowel and w[i] not in vowel]
    best = min(pair or cuts or [min(limit - 1, len(w) // 2)], key=lambda i: abs(i - len(w) / 2))
    return [w[:best] + "-", w[best:]]


def split_long(words, limit):
    """Break any word longer than `limit` at its hyphens or em dashes (El-Elohe-Israel., Benjamin—180,000), or
    hyphenate it near the middle (Nebuchad-nezzar’s), so a single-line cue never overflows."""
    out = []
    for w, a, b in words:
        if len(w) <= limit:
            out.append((w, a, b))
            continue
        pieces = [""]
        for p in re.findall(r"[^-—]+[-—]?|[-—]", w) if ("-" in w or "—" in w) else hyphenate(w, limit):
            if pieces[-1] and len(pieces[-1] + p) > limit:
                pieces.append(p)
            else:
                pieces[-1] += p
        acc = 0
        for p in pieces:
            out.append((p, a + (b - a) * acc / len(w), a + (b - a) * (acc + len(p)) / len(w)))
            acc += len(p)
    return out


def chunks(words, limit, lines=1):
    """Greedy word chunks of at most `limit` characters per line and `lines` lines, preferring clause breaks."""
    cap = limit * lines
    out, cur = [], []
    for i, w in enumerate(words):
        trial = " ".join(x[0] for x in cur + [w])
        fits = len(trial) <= limit if lines == 1 else all(len(l) <= limit for l in wrap2(trial, limit).split("\n"))
        if cur and not fits:
            out.append(cur)
            cur = [w]
        else:
            cur.append(w)
        if lines > 1 and cur and BREAK.search(w[0]) and len(" ".join(x[0] for x in cur)) > cap * 0.55 and i < len(words) - 1:
            out.append(cur)
            cur = []
    if cur:
        out.append(cur)
    return out


def wrap2(text, limit=42):
    if len(text) <= limit:
        return text
    words = text.split()
    best, bi = None, 1
    for i in range(1, len(words)):
        a, b = " ".join(words[:i]), " ".join(words[i:])
        width = max(len(a), len(b))
        score = width + (0 if BREAK.search(words[i - 1]) else 6) + (100 if width > limit else 0)
        if best is None or score < best:
            best, bi = score, i
    return " ".join(words[:bi]) + "\n" + " ".join(words[bi:])


def build(clips, limit, lines):
    cues = []
    for ci, c in enumerate(clips):
        words = timed_words(c)
        if lines == 1:
            words = split_long(words, limit)
        nxt = clips[ci + 1]["frame"] / FPS if ci + 1 < len(clips) else None
        groups = chunks(words, limit, lines)
        for gi, g in enumerate(groups):
            start = g[0][1] - 0.05
            if gi + 1 < len(groups):
                end = groups[gi + 1][0][1] - 0.06
            else:
                end = g[-1][2] + 0.5
                if nxt is not None:
                    end = min(end, nxt - 0.1)
            text = " ".join(w[0] for w in g)
            cues.append((start, max(end, start + 0.4), wrap2(text, limit) if lines > 1 else text))
    fixed = []
    for i, (a, b, t) in enumerate(cues):
        if i + 1 < len(cues):
            b = min(b, cues[i + 1][0] - 0.04)
        fixed.append((a, b, t))
    return "\n".join(f"{i + 1}\n{stamp(a)} --> {stamp(b)}\n{t}\n" for i, (a, b, t) in enumerate(fixed))


def main(folder: str):
    root = film_dir(folder)
    cues = json.loads((root / "narration" / "cues.json").read_text(encoding="utf-8"))["clips"]
    out = root / "out"
    out.mkdir(exist_ok=True)
    land = build(cues, 42, 2)
    port = build(cues, 15, 1)
    for kinds, text in ((LAND, land), (PORT, port)):
        for k in kinds:
            (out / f"{folder}-{k}{SRT}").write_text(text, encoding="utf-8")
    print(f"{folder}: {land.count(' --> ')} landscape cues, {port.count(' --> ')} vertical cues")


if __name__ == "__main__":
    main(sys.argv[1])
