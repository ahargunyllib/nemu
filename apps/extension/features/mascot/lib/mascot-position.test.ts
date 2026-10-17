import { describe, expect, test } from "vite-plus/test";

import {
  besideComposer,
  besideCursor,
  CURSOR_OFFSET,
  followCursor,
  MASCOT_SIZE,
  type Point,
} from "./mascot-position";

const VIEWPORT = { width: 1280, height: 800 };

function covers(mascot: Point, point: Point): boolean {
  return (
    point.x >= mascot.x &&
    point.x <= mascot.x + MASCOT_SIZE &&
    point.y >= mascot.y &&
    point.y <= mascot.y + MASCOT_SIZE
  );
}

describe("besideCursor", () => {
  test("sits 12 px below and to the right of the cursor", () => {
    expect(besideCursor({ x: 400, y: 300 }, VIEWPORT)).toEqual({ x: 412, y: 312 });
  });

  test("moves to the other side at the viewport's edge, still clear of the cursor", () => {
    const cursor = { x: 1270, y: 790 };
    const mascot = besideCursor(cursor, VIEWPORT);

    expect(mascot).toEqual({
      x: cursor.x - CURSOR_OFFSET - MASCOT_SIZE,
      y: cursor.y - CURSOR_OFFSET - MASCOT_SIZE,
    });
    expect(covers(mascot, cursor)).toBe(false);
  });
});

describe("besideComposer", () => {
  test("waits above and to the left of where the Composer opened, clear of the panel", () => {
    const anchor = { x: 400, y: 300 };
    const mascot = besideComposer(anchor);

    expect(mascot.x + MASCOT_SIZE).toBeLessThan(anchor.x);
    expect(mascot.y + MASCOT_SIZE).toBeLessThan(anchor.y);
  });
});

describe("followCursor", () => {
  const start = { x: 400, y: 300 };
  const resting = besideCursor(start, VIEWPORT);

  test("follows the cursor and never ends up under its tip", () => {
    const moves = [
      { x: 300, y: 200 },
      { x: 300, y: 600 },
      { x: 900, y: 250 },
      { x: 20, y: 20 },
    ];
    let mascot = resting;
    let previous = start;
    for (const cursor of moves) {
      mascot = followCursor(mascot, previous, cursor, VIEWPORT);
      previous = cursor;
      expect(mascot).toEqual(besideCursor(cursor, VIEWPORT));
      expect(covers(mascot, cursor)).toBe(false);
    }
  });

  test("waits while the cursor closes in on it, so it can be clicked", () => {
    const closer = { x: start.x + 8, y: start.y + 8 };
    const onIt = { x: resting.x + MASCOT_SIZE / 2, y: resting.y + MASCOT_SIZE / 2 };

    const afterCloser = followCursor(resting, start, closer, VIEWPORT);
    expect(afterCloser).toEqual(resting);
    expect(followCursor(afterCloser, closer, onIt, VIEWPORT)).toEqual(resting);
  });

  test("moves on once the cursor heads away from it", () => {
    const away = { x: start.x - 4, y: start.y - 4 };
    expect(followCursor(resting, start, away, VIEWPORT)).toEqual(besideCursor(away, VIEWPORT));
  });
});
