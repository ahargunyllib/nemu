"""Draws the synthetic F3-1 setoran book photo for class 4A (SDIT Nusantara, synthetic data).

The official F3-1 test pack isn't in this public repo, so this page stands in for it: three
students' setoran on Tuesday 1 December 2026, matching `fixtures/F3-1_kunci.csv`. Citra
Lestari's Tajwid is smudged, so Nemu must ask for it (#220: never guess).

The offline school AI (`NEMU_RESPONDER=fixture`) can't read pixels, so the page carries what a
model would read from it as JSON in a PNG text chunk named `nemu-fixture`
(`fixtures/form-photo.ts`). The reading uses the BPMN's field ids, not any tahfidz code, and the
boxes are where this script draws each cell, on a 0-1000 scale, so W5-style crops show the cell.

Run: python3 packages/ai/scripts/f3-1-photo.py  (needs Pillow and the macOS Bradley Hand font)
"""

import csv
import json
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont
from PIL.PngImagePlugin import PngInfo

FIXTURES = Path(__file__).resolve().parent.parent / "src/school/fixtures"
OUT = FIXTURES / "F3-1_foto-buku-setoran-tahfidz-4A.png"
W, H = 1400, 1000
FONT = "/System/Library/Fonts/Supplemental/Bradley Hand Bold.ttf"

# Columns on the 0-1000 scale: (field id or None, header, x0, x1).
COLUMNS = [
    (None, "No", 40, 90),
    ("murid", "Nama", 100, 360),
    ("surah", "Surah", 370, 540),
    ("ayat", "Ayat", 550, 680),
    ("fashohah", "F", 690, 760),
    ("tartil", "T", 770, 840),
    ("tajwid", "Tj", 850, 920),
    ("adab", "A", 930, 990),
]
ROW_TOP, ROW_H = 300, 110
SMUDGED = ("Citra Lestari", "tajwid")

random.seed(213)
rows = list(csv.DictReader(open(FIXTURES / "F3-1_kunci.csv", encoding="utf-8")))

page = Image.new("RGB", (W, H), (247, 243, 230))
draw = ImageDraw.Draw(page)
ink = (28, 42, 92)
font = ImageFont.truetype(FONT, 34)
small = ImageFont.truetype(FONT, 28)


def px(x, y):
    return int(x * W / 1000), int(y * H / 1000)


# Ruled lines like a school exercise book.
for y in range(120, 1000, 55):
    draw.line([px(0, y), px(1000, y)], fill=(196, 210, 228), width=2)
draw.line([px(30, 0), px(30, 1000)], fill=(220, 150, 150), width=3)

draw.text(px(60, 60), "Buku Setoran Tahfidz - Kelas 4A", fill=ink, font=font)
draw.text(px(600, 60), "Selasa, 1 Desember 2026", fill=ink, font=font)
for _, header, x0, _ in COLUMNS:
    draw.text(px(x0, 200), header, fill=ink, font=small)
draw.line([px(40, 260), px(990, 260)], fill=ink, width=2)

reading_rows = []
for line, row in enumerate(rows, start=1):
    top = ROW_TOP + (line - 1) * ROW_H
    box = lambda x0, x1: [x0, top - 10, x1, top + 70]  # noqa: E731
    texts = {
        None: str(line),
        "murid": row["murid"],
        "surah": row["surah"],
        "ayat": f"{row['ayat_dari']}-{row['ayat_sampai']}",
        "fashohah": row["fashohah"],
        "tartil": row["tartil"],
        "tajwid": row["tajwid"],
        "adab": row["adab"],
    }
    cells = []
    for field, _, x0, x1 in COLUMNS:
        jitter = random.randint(-4, 4)
        draw.text(px(x0, top + jitter), texts[field], fill=ink, font=font)
        if (row["murid"], field) == SMUDGED:
            # A thumb smudge over the digits: written, but not readable for sure.
            blot = Image.new("L", (W, H), 0)
            ImageDraw.Draw(blot).ellipse([*px(x0 - 5, top - 5), *px(x1, top + 60)], fill=230)
            blot = blot.filter(ImageFilter.GaussianBlur(10))
            page.paste((120, 128, 160), mask=blot)
            draw.line([px(x0, top + 10), px(x1 - 5, top + 45)], fill=ink, width=5)
        if field in (None, "murid"):
            continue
        if field == "ayat":
            cells.append({"field": "ayat_dari", "value": row["ayat_dari"], "unreadable": False, "candidates": [], "box": box(x0, x1)})
            cells.append({"field": "ayat_sampai", "value": row["ayat_sampai"], "unreadable": False, "candidates": [], "box": box(x0, x1)})
            continue
        smudged = (row["murid"], field) == SMUDGED
        cells.append(
            {
                "field": field,
                "value": None if smudged else texts[field],
                "unreadable": smudged,
                "candidates": ["81", "87"] if smudged else [],
                "box": box(x0, x1),
            }
        )
    reading_rows.append({"line": line, "name": row["murid"], "box": box(100, 360), "cells": cells})

page = page.filter(ImageFilter.GaussianBlur(0.6))
reading = {"readable": True, "key_field": "murid", "header": [], "rows": reading_rows}
info = PngInfo()
info.add_text("nemu-fixture", json.dumps(reading, ensure_ascii=True))
page.save(OUT, pnginfo=info, optimize=True)
print(f"Wrote {OUT}")
