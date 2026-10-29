import type { Box } from "../../../shared/types/box";

export type Point = { x: number; y: number };
export type Viewport = { width: number; height: number };

/** The mascot is a 32 px square, the top of the issue's 24–32 px (the stock `icon-sm` button). */
export const MASCOT_SIZE = 32;
/** The gap between the cursor's tip and the mascot. */
export const CURSOR_OFFSET = 12;
/** How close the cursor must come before the mascot waits for it instead of moving on. */
export const REACH = 16;
/** How far the hide button sticks out of the mascot's corner. */
export const HIDE_BUTTON_OVERHANG = 12;
/** How long the mascot takes to catch up with the cursor. */
export const FOLLOW_MS = 150;

/**
 * The mascot's top-left corner beside a cursor: 12 px below and to the right, or on the other side
 * where that would leave the viewport. Either way the cursor's tip stays clear, so the mascot never
 * sits on what the cursor is about to click.
 */
export function besideCursor(cursor: Point, viewport: Viewport): Point {
  const reach = CURSOR_OFFSET + MASCOT_SIZE;
  return {
    x: cursor.x + reach <= viewport.width ? cursor.x + CURSOR_OFFSET : cursor.x - reach,
    y: cursor.y + reach <= viewport.height ? cursor.y + CURSOR_OFFSET : cursor.y - reach,
  };
}

/**
 * Where the mascot sits while Rina drags a Blok area: as the cursor at the box's bottom-right
 * corner, clear of the corner handle.
 */
export function atAreaCorner(area: Box, viewport: Viewport): Point {
  return besideCursor({ x: area.left + area.width, y: area.top + area.height }, viewport);
}

/**
 * Where the mascot waits while the Composer is open: above and to the left of the point the
 * Composer opened at, clear of the panel that opens below and to the right of it.
 */
export function besideComposer(anchor: Point): Point {
  const reach = CURSOR_OFFSET + MASCOT_SIZE;
  return { x: Math.max(0, anchor.x - reach), y: Math.max(0, anchor.y - reach) };
}

/** Where the mascot is while it follows the cursor, and whether it has stopped to be clicked. */
export type Followed = { at: Point; waiting: boolean };

/**
 * Where the mascot goes when the cursor moves from `previous` to `cursor`. It follows, except that
 * it waits while the cursor is on it or closing in on it, so Rina can catch it and click it.
 */
export function followCursor(
  mascot: Point | null,
  previous: Point | null,
  cursor: Point,
  viewport: Viewport,
): Followed {
  if (mascot && previous && isReaching(mascot, previous, cursor)) {
    return { at: mascot, waiting: true };
  }
  return { at: besideCursor(cursor, viewport), waiting: false };
}

function isReaching(mascot: Point, previous: Point, cursor: Point): boolean {
  const within = (point: Point, margin: number) =>
    point.x >= mascot.x - margin &&
    point.x <= mascot.x + MASCOT_SIZE + margin &&
    point.y >= mascot.y - margin &&
    point.y <= mascot.y + MASCOT_SIZE + margin;
  if (!within(cursor, REACH)) return false;
  if (within(cursor, HIDE_BUTTON_OVERHANG)) return true;
  const center = { x: mascot.x + MASCOT_SIZE / 2, y: mascot.y + MASCOT_SIZE / 2 };
  return distance(cursor, center) < distance(previous, center);
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
