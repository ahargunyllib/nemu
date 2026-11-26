/**
 * Where the Nemu cursor rests and where the bubble goes beside it (PRD §6.2, F0-16). Pure
 * geometry in viewport pixels, so the rules are testable without a browser.
 */

export type Rect = { left: number; top: number; width: number; height: number };
export type Size = { width: number; height: number };
export type Point = { x: number; y: number };
export type BubbleSide = "right" | "below-right" | "below" | "above-right" | "above" | "left";

/** The highlight ring sits this far outside the target (docs/design-system.md, Sorot arahkan). */
export const HIGHLIGHT_OFFSET = 4;
/** Diameter of the Nemu cursor dot. */
export const CURSOR_SIZE = 20;
/** Space between the cursor (or the ringed target) and the bubble. */
export const BUBBLE_GAP = 12;
/** Nothing Nemu draws comes closer than this to the window's edge. */
export const VIEWPORT_MARGIN = 8;

const SIDES: readonly BubbleSide[] = [
  "right",
  "below-right",
  "below",
  "above-right",
  "above",
  "left",
];

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

/**
 * The cursor's centre once it arrives: just outside the ring's right edge, level with the
 * target's middle, so it points at the target without covering it.
 */
export function cursorPoint(target: Rect, viewport: Size): Point {
  const x = target.left + target.width + HIGHLIGHT_OFFSET + CURSOR_SIZE / 2 + 2;
  return {
    x: clamp(x, VIEWPORT_MARGIN, viewport.width - VIEWPORT_MARGIN - CURSOR_SIZE / 2),
    y: target.top + target.height / 2,
  };
}

/** The area the bubble must stay out of: the ringed target plus the cursor on its right. */
function keepClear(target: Rect): { left: number; top: number; right: number; bottom: number } {
  return {
    left: target.left - HIGHLIGHT_OFFSET,
    top: target.top - HIGHLIGHT_OFFSET,
    right: target.left + target.width + HIGHLIGHT_OFFSET + CURSOR_SIZE + 2,
    bottom: target.top + target.height + HIGHLIGHT_OFFSET,
  };
}

export type BubblePlacement = { side: BubbleSide; left: number; top: number };

/**
 * Puts the bubble on the free side of the cursor. Sides are tried in order (right of the cursor,
 * below-right, below, above-right, above, left of the target); the first that fits in the window
 * and covers none of the page's own controls (`obstacles`, such as the next fields to fill) wins.
 * Failing that, the first that fits; failing that, the roomiest, pushed back inside the window.
 * It never covers the target itself unless the window is too small for any side.
 */
export function placeBubble(
  target: Rect,
  bubble: Size,
  viewport: Size,
  obstacles: readonly Rect[] = [],
): BubblePlacement {
  const clear = keepClear(target);
  const minX = VIEWPORT_MARGIN;
  const minY = VIEWPORT_MARGIN;
  const maxX = viewport.width - VIEWPORT_MARGIN - bubble.width;
  const maxY = viewport.height - VIEWPORT_MARGIN - bubble.height;
  const besideY = clamp(clear.top, minY, Math.max(minY, maxY));
  const alignedX = clamp(clear.right - bubble.width, minX, Math.max(minX, maxX));
  const rightX = clear.right + BUBBLE_GAP;
  const belowY = clear.bottom + BUBBLE_GAP;
  const aboveY = clear.top - BUBBLE_GAP - bubble.height;
  const leftX = clear.left - BUBBLE_GAP - bubble.width;

  const candidates: Record<BubbleSide, { left: number; top: number; room: number }> = {
    right: { left: rightX, top: besideY, room: maxX - rightX },
    "below-right": { left: rightX, top: belowY, room: Math.min(maxX - rightX, maxY - belowY) },
    below: { left: alignedX, top: belowY, room: maxY - belowY },
    "above-right": { left: rightX, top: aboveY, room: Math.min(maxX - rightX, aboveY - minY) },
    above: { left: alignedX, top: aboveY, room: aboveY - minY },
    left: { left: leftX, top: besideY, room: leftX - minX },
  };

  const fits = (side: BubbleSide) => candidates[side].room >= 0;
  const free = (side: BubbleSide) =>
    !obstacles.some((obstacle) =>
      overlaps({ left: candidates[side].left, top: candidates[side].top, ...bubble }, obstacle),
    );
  const side =
    SIDES.find((side) => fits(side) && free(side)) ??
    SIDES.find(fits) ??
    SIDES.reduce((best, side) => (candidates[side].room > candidates[best].room ? side : best));
  const chosen = candidates[side];
  return {
    side,
    left: clamp(chosen.left, minX, Math.max(minX, maxX)),
    top: clamp(chosen.top, minY, Math.max(minY, maxY)),
  };
}

/** Whether two rectangles share any area. */
export function overlaps(a: Rect, b: Rect): boolean {
  return (
    a.left < b.left + b.width &&
    b.left < a.left + a.width &&
    a.top < b.top + b.height &&
    b.top < a.top + a.height
  );
}
