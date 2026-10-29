import { describe, expect, test } from "vite-plus/test";

import {
  atAreaCorner,
  atCardCorner,
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

describe("atAreaCorner", () => {
  test("sits beside the bottom-right corner of the box, clear of its handle", () => {
    const area = { left: 40, top: 300, width: 520, height: 140 };
    const mascot = atAreaCorner(area, VIEWPORT);

    expect(mascot).toEqual({ x: 572, y: 452 });
    expect(covers(mascot, { x: 560, y: 440 })).toBe(false);
  });
});

describe("atCardCorner", () => {
  test("sits on the card's top-left corner, reaching only into its rounded corner", () => {
    const card = { left: 950, top: 40, width: 280, height: 220 };
    const mascot = atCardCorner(card);

    expect(covers(mascot, { x: card.left, y: card.top })).toBe(true);
    // The card's text starts 12 px in from its top and 14 px from its left.
    expect(mascot.x + MASCOT_SIZE).toBeLessThan(card.left + 14);
    expect(mascot.y + MASCOT_SIZE).toBeLessThan(card.top + 12);
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
      const followed = followCursor(mascot, previous, cursor, VIEWPORT);
      expect(followed).toEqual({ at: besideCursor(cursor, VIEWPORT), waiting: false });
      expect(covers(followed.at, cursor)).toBe(false);
      mascot = followed.at;
      previous = cursor;
    }
  });

  test("waits while the cursor closes in on it, so it can be clicked", () => {
    const closer = { x: start.x + 8, y: start.y + 8 };
    const onIt = { x: resting.x + MASCOT_SIZE / 2, y: resting.y + MASCOT_SIZE / 2 };

    const afterCloser = followCursor(resting, start, closer, VIEWPORT);
    expect(afterCloser).toEqual({ at: resting, waiting: true });
    expect(followCursor(afterCloser.at, closer, onIt, VIEWPORT)).toEqual({
      at: resting,
      waiting: true,
    });
  });

  test("keeps waiting while the cursor moves about on it, even away from its center", () => {
    const onIt = { x: resting.x + MASCOT_SIZE / 2, y: resting.y + MASCOT_SIZE / 2 };
    const nearItsEdge = { x: resting.x + 2, y: resting.y + 2 };

    expect(followCursor(resting, onIt, nearItsEdge, VIEWPORT)).toEqual({
      at: resting,
      waiting: true,
    });
  });

  test("moves on and stops waiting once the cursor heads away from it", () => {
    const closer = { x: start.x + 8, y: start.y + 8 };
    const away = { x: start.x - 4, y: start.y - 4 };

    expect(followCursor(resting, start, closer, VIEWPORT).waiting).toBe(true);
    expect(followCursor(resting, closer, away, VIEWPORT)).toEqual({
      at: besideCursor(away, VIEWPORT),
      waiting: false,
    });
  });

  test("does not wait before it has a place or the cursor has a previous point", () => {
    expect(followCursor(null, null, start, VIEWPORT).waiting).toBe(false);
    expect(followCursor(resting, null, { x: start.x + 8, y: start.y + 8 }, VIEWPORT).waiting).toBe(
      false,
    );
  });
});
