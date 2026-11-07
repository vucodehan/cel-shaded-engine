"""Proof a film's script.json against the BSB text (WEB for books the BSB lacks): python script_check.py <film> "<Book>" <a-b> [...]

Prints the narrated character count (target about 5,500-6,300), the number of scenes and groups, any phrase that
is not found word for word in the given chapters (quote marks and dashes ignored; phrases split at sentence and
clause punctuation), and groups whose curly quotes do not balance. It also checks the structure that plan.py and
the film's scripts/score.py rely on (header keys, scene ids, moods, sfx names and their @g<n>+<frames> times), so
a script that passes here will not fail later in the pipeline. Exit code 1 if any structural error is found.
"""
import json
import re
import sys

from films import TEXTS, film_dir

sys.stdout.reconfigure(encoding="utf-8")

HEADER = ("label", "book", "title", "sub", "key", "scenes")
TIME = re.compile(r"(g(\d+)|end)?\s*([+-]\s*\d+)?")
RANGE_ONLY = {"riser", "swell", "rumble", "sparkle", "hammer"}


def norm(s):
    s = s.replace("’", "'").replace("‘", "'").replace("“", "").replace("”", "").replace('"', "").replace("—", " ").replace("–", "-").replace("[", "").replace("]", "")
    return re.sub(r"\s+", " ", s).strip().lower()


def score_vocab(root):
    src = (root / "scripts" / "score.py").read_text(encoding="utf-8")
    moods = set(re.findall(r'^\s+"(\w+)":\s*\(\[', src, re.M))
    sfx = set(re.findall(r'name == "(\w+)"', src))
    return moods, sfx


def structure(script, moods, sfx):
    errs = [f"missing header key {k!r}" for k in HEADER if k not in script]
    scenes = script.get("scenes", [])
    ids = [s.get("id") for s in scenes]
    if len(set(ids)) != len(ids):
        errs.append(f"duplicate scene ids: {sorted({i for i in ids if ids.count(i) > 1})}")
    if not scenes or scenes[0].get("kind") != "title":
        errs.append("first scene must be kind 'title'")
    if not scenes or scenes[-1].get("kind") != "end":
        errs.append("last scene must be kind 'end'")
    for s in scenes:
        sid, n = s.get("id"), len(s.get("groups", []))
        if s.get("kind") not in ("title", "end"):
            if not n:
                errs.append(f"{sid}: verse scene without groups")
            if s.get("mood", "calm") not in moods:
                errs.append(f"{sid}: unknown mood {s.get('mood')!r} (use one of {sorted(moods)})")
            if "ref" not in s:
                errs.append(f"{sid}: missing ref")
        for tag in s.get("sfx", []):
            name, _, when = tag.partition("@")
            if name not in sfx:
                errs.append(f"{sid}: unknown sfx {name!r} (use one of {sorted(sfx)})")
            if name in RANGE_ONLY and when and ">" not in when:
                errs.append(f"{sid}: {tag!r} needs a range ({name}@a>b) or the whole scene ({name})")
            for expr in filter(None, when.split(">")):
                expr = expr.strip()
                m = TIME.fullmatch(expr)
                if not expr.lstrip("-").isdigit() and not m:
                    errs.append(f"{sid}: bad sfx time {expr!r} in {tag!r}")
                elif m and m.group(2) is not None and int(m.group(2)) >= n:
                    errs.append(f"{sid}: {tag!r} points at group {m.group(2)} but the scene has {n} groups")
    return errs


def main(folder, refs):
    text = []
    sources = [TEXTS / n for n in ("bsb.txt", "web.txt")]
    for line in (l for t in sources if t.exists() for l in t.read_text(encoding="utf-8").splitlines()):
        ref, _, body = line.partition("\t")
        book, _, cv = ref.rpartition(" ")
        if ":" not in cv:
            continue
        ch = int(cv.split(":")[0])
        for b, rng in refs:
            lo, _, hi = rng.partition("-")
            if book == b and int(lo) <= ch <= int(hi or lo):
                text.append(body.strip())
    corpus = norm(" ".join(text))
    root = film_dir(folder)
    script = json.loads((root / "src" / "script.json").read_text(encoding="utf-8-sig"))
    chars = groups = 0
    for s in script["scenes"]:
        for g in s.get("groups", []):
            groups += 1
            say = g.get("say") or " ".join(g["t"].split()).replace("LORD", "Lord")
            chars += len(say)
            if s.get("kind") == "title":
                continue
            if g["t"].count("“") != g["t"].count("”"):
                print(f"  quotes unbalanced in {s['id']}: {g['t'][:70]}")
            for part in re.split(r"(?<=[.;:!?,])\s+|\n", g["t"]):
                p = norm(part).strip("'").rstrip(".,;:!?'")
                if len(p) > 12 and p not in corpus:
                    print(f"  not verbatim in {s['id']}: {part}")
    errs = structure(script, *score_vocab(root))
    for e in errs:
        print(f"  ERROR {e}")
    print(f"{folder}: {len(script['scenes'])} scenes, {groups} groups, {chars} narrated characters"
          + (f", {len(errs)} structural errors" if errs else ", structure ok"))
    return 1 if errs else 0


if __name__ == "__main__":
    a = sys.argv[1:]
    sys.exit(main(a[0], list(zip(a[1::2], a[2::2]))))
