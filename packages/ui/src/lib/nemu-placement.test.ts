import { describe, expect, test } from "vite-plus/test";

import { type Rect, cursorPoint, overlaps, placeBubble } from "./nemu-placement";

const viewport = { width: 1280, height: 800 };
const bubble = { width: 420, height: 200 };

function bubbleRect(target: Rect): Rect {
  const { left, top } = placeBubble(target, bubble, viewport);
  return { left, top, ...bubble };
}

describe("cursorPoint", () => {
  test("rests just right of the target, level with its middle", () => {
    const target = { left: 100, top: 300, width: 240, height: 40 };
    const point = cursorPoint(target, viewport);
    expect(point.x).toBeGreaterThan(target.left + target.width);
    expect(point.x).toBeLessThan(target.left + target.width + 30);
    expect(point.y).toBe(320);
  });
});

describe("placeBubble", () => {
  test("puts the bubble right of the cursor when there is room", () => {
    const placement = placeBubble(
      { left: 100, top: 300, width: 240, height: 40 },
      bubble,
      viewport,
    );
    expect(placement.side).toBe("right");
  });

  test("moves below a target on the window's right edge, then above one near the bottom", () => {
    expect(
      placeBubble({ left: 900, top: 100, width: 300, height: 40 }, bubble, viewport).side,
    ).toBe("below");
    expect(
      placeBubble({ left: 900, top: 700, width: 300, height: 40 }, bubble, viewport).side,
    ).toBe("above");
  });

  test("steps around the page's next fields instead of covering them", () => {
    // The mock AlurSekolah's Isi nilai row: Kelas (the target), then Mata Pelajaran, Jenis
    // Penilaian, and Tampilkan Siswa under Kelas.
    const kelas = { left: 252, top: 181, width: 240, height: 37 };
    const nextFields = [
      { left: 516, top: 181, width: 240, height: 37 },
      { left: 780, top: 181, width: 240, height: 37 },
      { left: 252, top: 234, width: 157, height: 40 },
    ];
    const placement = placeBubble(kelas, bubble, viewport, nextFields);
    const placed = { left: placement.left, top: placement.top, ...bubble };
    expect(placement.side).toBe("below-right");
    expect(nextFields.some((field) => overlaps(placed, field))).toBe(false);
    expect(overlaps(placed, kelas)).toBe(false);
  });

  test("never covers the target, wherever it is on the page", () => {
    for (let left = 0; left <= 1100; left += 100) {
      for (let top = 0; top <= 760; top += 40) {
        const target = { left, top, width: 180, height: 40 };
        expect(overlaps(bubbleRect(target), target), `target at ${left},${top}`).toBe(false);
      }
    }
  });

  test("stays inside the window", () => {
    const { left, top } = placeBubble(
      { left: 1200, top: 780, width: 80, height: 20 },
      bubble,
      viewport,
    );
    expect(left).toBeGreaterThanOrEqual(0);
    expect(top).toBeGreaterThanOrEqual(0);
    expect(left + bubble.width).toBeLessThanOrEqual(viewport.width);
    expect(top + bubble.height).toBeLessThanOrEqual(viewport.height);
  });
});
