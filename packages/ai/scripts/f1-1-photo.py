"""Draws the synthetic F1-1 grade-book photo for class 4B (SDIT Nusantara, synthetic data).

The official F1-1 test pack isn't in this public repo, so this page stands in for it. It is laid
out where the offline school AI (`NEMU_RESPONDER=fixture`, `fixtures/f1-photo.ts`) says its cells
are, so W5's crops from `inboxPhoto` show the cell each question is about:

- 32 lines in 01_profil-sekolah's 4B order, names spelled as the fixture writes them;
- value column x 600-700, line n at y 100+25(n-1) .. 120+25(n-1), on a 0-1000 scale;
- the four doubtful cells: 86 that looks like 88 (line 3), a hooked 61 (7), 71 that looks like
  77 (10), and 70 struck through with 78 beside it (15); S on line 21.

Run: python3 packages/ai/scripts/f1-1-photo.py  (needs Pillow and the macOS Bradley Hand font)
"""

import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

OUT = Path(__file__).resolve().parent.parent / "src/school/fixtures/f1-1-buku-nilai-4b.jpg"
W, H = 1240, 1754
FONT = "/System/Library/Fonts/Supplemental/Bradley Hand Bold.ttf"

# As the fixture's page spells them (`writtenName` in fixtures/f1-photo.ts).
NAMES = [
    "Ahmad Fadli", "Aisah Zahra", "Alya Nur Fitri", "Bagas Saputra", "Budi Santoso",
    "Citra Ayu Lestari", "Dimas Pratama", "Dinda Maharani", "Fahri Hidayat", "Farah Annisa",
    "Galih Ramadan", "Hana Salsabila", "Ilham Maulana", "Intan Permata", "Kevin Ardiansyah",
    "Layla Nur Azizah", "M. Rizky", "Nabila Putri Ramadhani", "Naufal Akbar", "Nur Aini",
    "Putra Wijaya", "Qonita Rahma", "Raka Aditia", "Rani Oktaviani", "Salsabila Putri",
    "Siti Nur Haliza", "Taufik Hidayatullah", "Tiara Anjani", "Umar Faruq", "Vyna Amelia",
    "Yusuf Alfarizi", "Zahra Khairunnisa",
]
VALUES = [
    "82", "74", "86", "58", "77", "91", "61", "70", "95", "71", "80", "81", "90", "65", "78",
    "73", "84", "69", "88", "72", "S", "93", "60", "76", "68", "79", "74", "87", "55", "83",
    "75", "97",
]

random.seed(4)
ink = (28, 42, 110)
page = Image.new("RGB", (W, H), (246, 243, 232))
draw = ImageDraw.Draw(page)
hand = ImageFont.truetype(FONT, 34)
small = ImageFont.truetype(FONT, 28)
title = ImageFont.truetype(FONT, 40)


def x(v: float) -> float:
    return v / 1000 * W


def y(v: float) -> float:
    return v / 1000 * H


def jitter(n: float = 3) -> float:
    return random.uniform(-n, n)


# Ruled lines and margins, like a school book.
for line in range(36):
    top = y(100 + line * 25) - 2
    draw.line([(0, top), (W, top)], fill=(178, 196, 222), width=2)
draw.line([(x(90), 0), (x(90), H)], fill=(220, 120, 120), width=2)
draw.line([(x(590), y(70)), (x(590), y(100 + 32 * 25))], fill=(120, 120, 120), width=2)
draw.line([(x(710), y(70)), (x(710), y(100 + 32 * 25))], fill=(120, 120, 120), width=2)

draw.text((x(110), y(22)), "Nilai UTS Matematika  -  Kelas 4B", font=title, fill=ink)
draw.text((x(110), y(68)), "No  Nama", font=small, fill=ink)
draw.text((x(620), y(68)), "UTS", font=small, fill=ink)

for index, (name, value) in enumerate(zip(NAMES, VALUES)):
    line = index + 1
    top = y(100 + index * 25)
    base = top + 2 + jitter(2)
    draw.text((x(30) + jitter(), base), f"{line}.", font=hand, fill=ink)
    draw.text((x(110) + jitter(), base), name, font=hand, fill=ink)
    left = x(625) + jitter(4)
    if line == 15:
        # Struck through and corrected beside it.
        draw.text((left - 12, base), "70", font=hand, fill=ink)
        draw.line([(left - 18, base + 22), (left + 40, base + 14)], fill=ink, width=4)
        draw.text((left + 48, base), "78", font=hand, fill=ink)
        continue
    draw.text((left, base), value, font=hand, fill=ink)
    if line == 3:
        # The 6 closed at the top, so it reads as 8 too.
        draw.arc([left + 22, base + 2, left + 40, base + 20], 200, 360, fill=ink, width=4)
    if line in (7, 10):
        # A long flag on the 1, so it looks like a 7.
        draw.line([(left + 22, base + 10), (left + 36, base + 6)], fill=ink, width=4)

# A phone photo: a slight tilt, soft focus and uneven light.
photo = page.rotate(-1.2, resample=Image.BICUBIC, expand=False, fillcolor=(90, 84, 72))
photo = photo.filter(ImageFilter.GaussianBlur(0.8))
shade = Image.new("L", (W, H))
shade_draw = ImageDraw.Draw(shade)
for row in range(0, H, 8):
    level = int(30 + 25 * math.sin(row / H * math.pi))
    shade_draw.rectangle([0, row, W, row + 8], fill=level)
photo = Image.composite(Image.new("RGB", (W, H), (255, 255, 255)), photo, shade.point(lambda v: v // 6))
photo.save(OUT, "JPEG", quality=78)
print(f"wrote {OUT}")
