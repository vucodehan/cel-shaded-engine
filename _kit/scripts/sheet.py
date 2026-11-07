"""Tile images into a contact sheet: python sheet.py out.jpg a.jpg b.jpg ...
Each tile keeps its own aspect inside a 960x540 (landscape) or 304x540 (portrait) cell, rows of 2 landscape or
mixed cells up to 1920 px wide."""
import sys
from pathlib import Path

from PIL import Image, ImageDraw

out, files = sys.argv[1], sys.argv[2:]
ims = [Image.open(f).convert("RGB") for f in files]
CH = 540
cells = []
for im in ims:
    w = round(CH * im.width / im.height)
    cells.append(im.resize((w, CH), Image.LANCZOS))
rows, row, x = [], [], 0
for c, f in zip(cells, files):
    if x + c.width > 1920 and row:
        rows.append(row)
        row, x = [], 0
    row.append((c, f))
    x += c.width
if row:
    rows.append(row)
sheet = Image.new("RGB", (1920, CH * len(rows)), (16, 14, 18))
d = ImageDraw.Draw(sheet)
for r, items in enumerate(rows):
    x = 0
    for c, f in items:
        sheet.paste(c, (x, r * CH))
        d.text((x + 8, r * CH + 6), Path(f).stem, fill=(255, 240, 120))
        x += c.width
sheet.save(out, quality=88)
print("sheet", out)
