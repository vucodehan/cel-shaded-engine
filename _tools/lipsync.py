"""Lip-sync track for the engine's lips(): python lipsync.py <audio> [out.json] [--text=FILE | --say="..."] [--sing]
                                           python lipsync.py "<film>" --line=45 [out.json]

Rhubarb Lip Sync 1.14 (_tools/bin/rhubarb, MIT, CPU) finds the mouth shapes; the voice's loudness envelope sets how
far the jaw opens inside each shape, so loud vowels open wider, sung notes hold their vowel and silences close the
mouth, and it opens Rhubarb's long teeth-together stretches on each syllable. The track has one shape and one jaw
opening per film frame, counted from the audio's first sample:

  {"fps": 30, "frames": 218, "shapes": "XXBBCCDD...", "open": [0, 0, 14, ...], "loud": [...], "cues": [...], ...}

  shapes  A closed (M B P), B teeth together (K S T EE), C open (EH AE), D wide (AA), E round (AO ER),
          F pucker (UW OW W), G lip under the teeth (F V), H tongue up (L), X rest
  open    jaw 0-100 inside the shape's range (0 for A and X); loud: the voice's loudness 0-100 (for gestures)

Every shape holds at least two frames, so a figure on twos never skips one (--sing: vowels and rests three).
<film> --line=N: that narration take, its text as Rhubarb's dialog, and a check of the closures against the
ElevenLabs word times. --text / --say: transcript or lyrics (always worth giving). --sing: an isolated vocal stem
(holds the vowel through sustained notes, closes the mouth in gaps of 100 ms). --lang=es: not English, so Rhubarb's
phonetic recognizer (it does not use the text). --recognizer=pocketSphinx|phonetic. --fps (default: the film's,
else 30). --lead=1: frames the mouth leads the sound. --gate=-34: dB under the voice's loud level that counts as
silence (--sing -26). Out: <film>/src/lips/<name>.json when the audio is in a film of this workspace, else
<audio>.lips.json beside it. Prints a few lines; exits 1 with a one-line reason on failure.
"""
import argparse
import json
import math
import re
import subprocess
import sys
import tempfile
import time
import wave
from array import array
from pathlib import Path

from films import WS, film_dir, take

RHUBARB = Path(__file__).resolve().parent / "bin" / "rhubarb" / "rhubarb.exe"
RHUBARB_VERSION = "1.14.0"
SR, HOP = 16000, 160  # analysis at 16 kHz, loudness every 10 ms
# jaw range (0..1) of each shape; the loudness picks the opening inside it
RANGE = {"A": (0, 0), "B": (0.10, 0.22), "C": (0.30, 0.70), "D": (0.55, 1.0), "E": (0.30, 0.65), "F": (0.15, 0.38),
         "G": (0.08, 0.16), "H": (0.30, 0.62), "X": (0, 0)}
WEIGHT = {"A": 1.8, "G": 1.3, "X": 0.9}  # a closure wins a frame it shares with an open shape
CLOSED = "AG"
VOWELS = "CDEFH"


def fail(msg):
    raise SystemExit(f"lipsync: {msg}")


def film_of(p):
    """The workspace film folder holding p, or None."""
    try:
        top = Path(p).resolve().relative_to(WS).parts[0]
    except (ValueError, IndexError):
        return None
    root = WS / top
    return root if top.startswith("[") and (root / "src").is_dir() else None


def default_out(audio, name):
    root = film_of(audio)
    stem = name or audio.stem
    return root / "src" / "lips" / f"{stem}.json" if root else audio.with_name(f"{stem}.lips.json")


def film_fps(out):
    root = film_of(out)
    t = root / "src" / "timing.json" if root else None
    return json.loads(t.read_text(encoding="utf-8")).get("fps") if t and t.exists() else None


def rel_ws(p):
    try:
        return Path(p).resolve().relative_to(WS).as_posix()
    except ValueError:
        return str(p)


def plain(text):
    """Typographic punctuation to ASCII for Rhubarb's dialog file."""
    t = text.translate({0x2018: "'", 0x2019: "'", 0x201C: '"', 0x201D: '"', 0x2026: "...", 0x2013: ", ", 0x2014: ", "})
    return re.sub(r"\s+", " ", t).strip()


def convert(src, dst):
    r = subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(src), "-ac", "1", "-ar", str(SR), "-af", "highpass=f=70",
                        "-c:a", "pcm_s16le", str(dst)], capture_output=True, text=True)
    if r.returncode or not dst.exists():
        fail(f"ffmpeg could not read {src.name}: {(r.stderr.strip().splitlines() or ['no message'])[-1]}")


def read_pcm(p):
    with wave.open(str(p), "rb") as w:
        a = array("h")
        a.frombytes(w.readframes(w.getnframes()))
    if sys.byteorder == "big":
        a.byteswap()
    return a


def loudness_db(a):
    """Level in dBFS every 10 ms (a ~30 ms window)."""
    ms = [sum(x * x for x in a[i:i + HOP]) / HOP for i in range(0, max(1, len(a) - HOP + 1), HOP)]
    sm = [(ms[max(0, k - 1)] + 2 * ms[k] + ms[min(len(ms) - 1, k + 1)]) / 4 for k in range(len(ms))]
    return [10 * math.log10(v / 1073741824.0 + 1e-12) for v in sm]


def levels(db, gate_rel):
    """Noise floor, silence gate and the voice's loud level (90th percentile of the voiced steps), in dBFS."""
    s = sorted(db)
    floor = s[len(s) // 10]
    voice = sorted(d for d in db if d > floor + 10)
    if len(voice) < 5:
        fail("no voice found: the audio is silent or flat noise")
    loud = voice[int(len(voice) * 0.9)]
    return floor, max(floor + 6, loud + gate_rel), loud


def jaw_envelope(db, loud, sing):
    """0..1 jaw from the level over the top 20 dB (24 sung): quick to open, slower to close (slower still sung)."""
    att, rel, curve, span = (0.04, 0.18, 0.7, 24.0) if sing else (0.03, 0.08, 0.8, 20.0)
    ka, kr = 1 - math.exp(-0.01 / att), 1 - math.exp(-0.01 / rel)
    out, v = [], 0.0
    for d in db:
        x = min(1.0, max(0.0, (d - loud + span) / span)) ** curve
        v += (ka if x > v else kr) * (x - v)
        out.append(v)
    return out


def per_frame(n, fps, lead, fn):
    """fn(i0, i1) over each frame's 10 ms steps, the frame shifted `lead` frames ahead of the sound."""
    out = []
    for i in range(n):
        i0 = int(math.floor((i + lead) / fps * 100))
        out.append(fn(i0, max(i0 + 1, int(math.ceil((i + 1 + lead) / fps * 100)))))
    return out


def shapes_per_frame(cues, n, fps, lead):
    """The cue covering most of each frame (closures weighted up)."""
    out, j = [], 0
    for i in range(n):
        t0, t1 = (i + lead) / fps, (i + 1 + lead) / fps
        while j < len(cues) and cues[j][1] <= t0:
            j += 1
        best, score, k = "X", 0.0, j
        while k < len(cues) and cues[k][0] < t1:
            s, e, v = cues[k]
            sc = (min(t1, e) - max(t0, s)) * WEIGHT.get(v, 1.0)
            if sc > score:
                best, score = v, sc
            k += 1
        out.append(best)
    return out


def hold_notes(sh, voiced):
    """Sung: a voiced stretch Rhubarb left at rest holds the vowel beside it (it hears a long note as no speech)."""
    i = 0
    while i < len(sh):
        if sh[i] != "X" or not voiced[i]:
            i += 1
            continue
        j = i
        while j < len(sh) and sh[j] == "X" and voiced[j]:
            j += 1
        near = [sh[k] for k in (i - 1, j) if 0 <= k < len(sh) and sh[k] in VOWELS]
        for k in range(i, j):
            sh[k] = near[0] if near else "C"
        i = j


def sustain(sh, ldb, gate):
    """Sung: a long note Rhubarb heard as B (teeth together) opens to C after its first two frames, as singers do."""
    n, i = len(sh), 0
    while i < n:
        if sh[i] != "B":
            i += 1
            continue
        j = i
        while j < n and sh[j] == "B":
            j += 1
        if j - i >= 8:
            for k in range(i + 2, j - 2):
                if ldb[k] > gate + 10:
                    sh[k] = "C"
        i = j


def close_gaps(sh, voiced, n_min):
    """Silence of n_min frames or more closes the mouth (a closure stays a closure)."""
    i = 0
    while i < len(sh):
        if voiced[i]:
            i += 1
            continue
        j = i
        while j < len(sh) and not voiced[j]:
            j += 1
        if j - i >= n_min:
            for k in range(i, j):
                if sh[k] != "A":
                    sh[k] = "X"
        i = j


def open_syllables(sh, ldb, gate, prom):
    """Rhubarb's catch-all B (teeth together) can cover several syllables when it hears no vowel: a stretch of six
    frames or more opens to C for three frames on each loudness peak that stands prom dB clear (a syllable's vowel),
    keeping two B frames at its ends and between openings."""
    n, i = len(sh), 0
    while i < n:
        if sh[i] != "B":
            i += 1
            continue
        j = i
        while j < n and sh[j] == "B":
            j += 1
        if j - i >= 6:
            end = i - 1
            for p in range(i + 3, j - 3):
                lo = max(min(ldb[max(i, p - 4):p]), min(ldb[p + 1:min(j, p + 5)]))
                if p - 1 >= end + 3 and ldb[p] >= ldb[p - 1] and ldb[p] >= ldb[p + 1] and ldb[p] - lo >= prom and ldb[p] > gate + 10:
                    sh[p - 1:p + 2] = ["C"] * 3
                    end = p + 1
        i = j


def min_runs(sh, need):
    """Every run lasts need(shape) frames: a short closure takes a frame from an open neighbour, any other short run
    becomes the shape before it (after it when that one is a closure), so the mouth holds instead of flickering."""
    r = []
    for v in sh:
        if r and r[-1][0] == v:
            r[-1][1] += 1
        else:
            r.append([v, 1])
    i = 0
    while i < len(r) and len(r) > 1:
        v, ln = r[i]
        if ln >= need(v):
            i += 1
            continue
        prev = r[i - 1] if i else None
        nxt = r[i + 1] if i + 1 < len(r) else None
        if v in CLOSED:
            donors = [x for x in (prev, nxt) if x and x[0] not in CLOSED and x[1] >= 2]
            if donors:
                d = max(donors, key=lambda x: (x[1] > need(x[0]), x[1]))
                d[1] -= 1
                r[i][1] += 1
                i = max(0, i - 1)
                continue
        tgt = prev if prev and (prev[0] not in CLOSED or not nxt) else nxt
        tgt[1] += ln
        del r[i]
        j = max(0, i - 1)
        if j + 1 < len(r) and r[j][0] == r[j + 1][0]:
            r[j][1] += r[j + 1][1]
            del r[j + 1]
        i = max(0, i - 2)
    return [v for v, ln in r for _ in range(ln)]


def openness(sh, jaw, hyst=0.1):
    """Jaw 0-100 per frame inside each shape's range, in steps of 0.05 that move only by 0.1 or with the shape."""
    out, held, last = [], 0.0, None
    for v, j in zip(sh, jaw):
        lo, hi = RANGE[v]
        o = round((lo + (hi - lo) * j) * 20) / 20 if hi > 0 else 0.0
        if v != last or abs(o - held) >= hyst:
            held = o
        out.append(int(round(held * 100)))
        last = v
    return out


def closure_check(words, sh, fps, lead, tol=2):
    """Word starts with b/m/p (f/v) that have a closed (lip-under-teeth) frame within tol frames."""
    res = []
    for label, letters, want in (("b/m/p", "bmp", "A"), ("f/v", "fv", "G")):
        starts = [round(w["s"] * fps) for w in words if re.sub(r"^[^A-Za-z]+", "", w["w"])[:1].lower() in letters]
        hit = sum(any(sh[k] == want for k in range(max(0, f - tol - int(lead)), min(len(sh), f + tol + 1))) for f in starts)
        res.append(f"{label} {hit}/{len(starts)}")
    return res


def main():
    ap = argparse.ArgumentParser(description="Lip-sync track (Rhubarb shapes + loudness jaw) for the engine's lips()")
    ap.add_argument("src", help="audio file (wav, mp3, ...), or a film folder with --line")
    ap.add_argument("out", nargs="?", help="track .json (default: <film>/src/lips/<name>.json or <audio>.lips.json)")
    ap.add_argument("--line", type=int, help="narration take number of the film (narration/lines.json)")
    ap.add_argument("--text", help="transcript or lyrics file")
    ap.add_argument("--say", help="transcript or lyrics")
    ap.add_argument("--sing", action="store_true", help="an isolated vocal stem: hold notes, close in gaps")
    ap.add_argument("--lang", default="en")
    ap.add_argument("--recognizer", choices=("pocketSphinx", "phonetic"))
    ap.add_argument("--fps", type=float)
    ap.add_argument("--lead", type=float, default=1.0)
    ap.add_argument("--gate", type=float)
    a = ap.parse_args()
    t_start = time.time()
    if not RHUBARB.exists():
        fail(f"Rhubarb is missing: unzip Rhubarb-Lip-Sync-{RHUBARB_VERSION}-Windows into {RHUBARB.parent}")
    text, words, name = a.say, None, None
    if a.line is not None:
        root = film_dir(a.src)
        lines_p = root / "narration" / "lines.json"
        if not lines_p.exists():
            fail(f"{a.src}: no narration/lines.json")
        clip = next((c for c in json.loads(lines_p.read_text(encoding="utf-8")) if c["i"] == a.line), None)
        if not clip:
            fail(f"{a.src}: no narration line {a.line}")
        audio = take(root, clip)
        text = text or clip.get("say") or clip.get("text")
        words = clip.get("words")
        name = f"line-{a.line:02d}"
    else:
        audio = Path(a.src)
    if a.text:
        if not Path(a.text).exists():
            fail(f"no text file {a.text}")
        text = Path(a.text).read_text(encoding="utf-8-sig")
    if not audio.is_file():
        fail(f"no audio file {audio}")
    out = Path(a.out) if a.out else default_out(audio, name)
    fps = a.fps or film_fps(out) or 30
    fps = int(fps) if float(fps).is_integer() else fps
    rec = a.recognizer or ("pocketSphinx" if a.lang.lower().startswith("en") else "phonetic")
    dialog = bool(text) and rec == "pocketSphinx"
    gate_rel = a.gate if a.gate is not None else (-26.0 if a.sing else -34.0)

    with tempfile.TemporaryDirectory(prefix="lipsync-") as tmp:
        tmp = Path(tmp)
        wav, cues_p = tmp / "voice.wav", tmp / "cues.json"
        convert(audio, wav)
        pcm = read_pcm(wav)
        secs = len(pcm) / SR
        if secs < 0.1:
            fail(f"{audio.name} is shorter than 0.1 s")
        cmd = [str(RHUBARB), "-q", "-f", "json", "-o", str(cues_p), "-r", rec, "--extendedShapes", "GHX"]
        if dialog:
            (tmp / "dialog.txt").write_text(plain(text), encoding="utf-8")
            cmd += ["-d", str(tmp / "dialog.txt")]
        t0 = time.time()
        r = subprocess.run(cmd + [str(wav)], capture_output=True, text=True, cwd=RHUBARB.parent)
        t_rh = time.time() - t0
        if r.returncode or not cues_p.exists():
            fail("rhubarb: " + ((r.stderr or r.stdout).strip().splitlines() or ["failed without a message"])[-1])
        cues = [(c["start"], c["end"], c["value"]) for c in json.loads(cues_p.read_text(encoding="utf-8"))["mouthCues"]]

    db = loudness_db(pcm)
    _, gate, loud = levels(db, gate_rel)
    env = jaw_envelope(db, loud, a.sing)
    n = int(math.ceil(secs * fps))
    jaw = per_frame(n, fps, a.lead, lambda i0, i1: sum(env[i0:i1]) / max(1, len(env[i0:i1])))
    ldb = per_frame(n, fps, a.lead, lambda i0, i1: max(db[i0:i1], default=-120.0))
    voiced = [d > gate for d in ldb]
    sh = shapes_per_frame(cues, n, fps, a.lead)
    if a.sing:
        hold_notes(sh, voiced)
        sustain(sh, ldb, gate)
    close_gaps(sh, voiced, 3 if a.sing else 4)
    open_syllables(sh, ldb, gate, 6.0 if a.sing else 3.0)
    sh = min_runs(sh, (lambda v: 3 if v in VOWELS or v == "X" else 2) if a.sing else (lambda v: 2))
    op = openness(sh, jaw)

    track = {
        "kind": "lipsync", "version": 1, "fps": fps, "frames": n, "seconds": round(secs, 3), "source": rel_ws(audio),
        "text": plain(text) if text else "", "mode": "sing" if a.sing else "speech",
        "recognizer": rec + (" + dialog" if dialog else ""), "lead": a.lead, "rhubarb": RHUBARB_VERSION,
        "shapes": "".join(sh), "open": op, "loud": [int(round(j * 100)) for j in jaw],
        "cues": [[round(s, 3), v] for s, _, v in cues],
    }
    out.parent.mkdir(parents=True, exist_ok=True)
    body = ",\n".join(f'  "{k}": {json.dumps(v, ensure_ascii=False, separators=(",", ":"))}' for k, v in track.items())
    out.write_text("{\n" + body + "\n}\n", encoding="utf-8")

    changes = sum(1 for i in range(1, n) if sh[i] != sh[i - 1])
    share = " ".join(f"{v} {100 * sh.count(v) / n:.0f}%" for v in "XABCDEFGH" if v in sh)
    print(f"lipsync: {audio.name} {secs:.2f} s -> {n} frames at {fps} fps ({track['recognizer']}, {track['mode']}, lead {a.lead:g})")
    print(f"  shapes {share}; {changes} changes, jaw up to {max(op) / 100:.2f}")
    if words:
        print(f"  closures within 2 frames of the word starts (ElevenLabs times): {', '.join(closure_check(words, sh, fps, a.lead))}")
    print(f"  rhubarb {t_rh:.1f} s, total {time.time() - t_start:.1f} s: {out}")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except SystemExit:
        raise
    except Exception as e:  # one line, not a traceback
        fail(f"{type(e).__name__}: {e}")
