"""Print Berean Standard Bible (public domain) passages: python bsb.py Exodus 1-4 [Numbers 13-14 ...]

Books the BSB lacks come from texts/web.txt (World English Bible, public domain): Tobit, Judith, "Esther (Greek)"
(the additions are in [brackets]), Wisdom, Sirach, Baruch, "1 Maccabees", "2 Maccabees", "Daniel (Greek)".
"""
import sys
from pathlib import Path

TEXTS = [Path(__file__).resolve().parent / "texts" / n for n in ("bsb.txt", "web.txt")]
verses = {}
for line in (l for t in TEXTS if t.exists() for l in t.read_text(encoding="utf-8").splitlines()):
    ref, _, body = line.partition("\t")
    book, _, cv = ref.rpartition(" ")
    if ":" in cv:
        ch, vs = cv.split(":")
        verses.setdefault((book, int(ch)), []).append((int(vs), body.strip()))

sys.stdout.reconfigure(encoding="utf-8")
args = sys.argv[1:]
for book, rng in zip(args[::2], args[1::2]):
    a, _, b = rng.partition("-")
    for ch in range(int(a), int(b or a) + 1):
        print(f"\n## {book} {ch}")
        for v, t in verses.get((book, ch), []):
            print(f"{v} {t}")
