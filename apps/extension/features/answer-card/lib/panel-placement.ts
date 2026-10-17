import type { Box } from "../../../shared/types/box";

export const PANEL_WIDTH = 384;
const GAP = 12;

export type Point = { x: number; y: number };
export type Viewport = { width: number; height: number };

/** Where the Composer and Answer Card panel sits: anchored by its top or, growing upward, its bottom. */
export type PanelPlacement = { left: number; maxHeight: number } & (
  | { top: number }
  | { bottom: number }
);

/** Shrinking the panel to scroll in less room than this hides too much of it to be worth it. */
const MIN_HEIGHT = 160;

/**
 * Places the panel beside the cursor, unless it would cover a highlighted area; then it moves to
 * the first viewport corner that covers none. When the panel is too tall for every spot, it takes
 * the spot with the most clear room and shrinks to it, scrolling, rather than covering a highlight.
 * Only when no spot has usable room does it cover, and then as little as possible.
 */
export function placePanel(
  cursor: Point,
  viewport: Viewport,
  panelHeight: number,
  avoid: readonly Box[],
): PanelPlacement {
  const preferred = besideCursor(cursor, viewport);
  const candidates = [preferred, ...corners(viewport)];
  let roomiest = preferred;
  let roomiestHeight = 0;
  let leastCovering = preferred;
  let leastOverlap = Number.POSITIVE_INFINITY;

  for (const candidate of candidates) {
    const room = clearHeight(candidate, viewport, avoid);
    if (room >= Math.min(panelHeight, candidate.maxHeight)) return candidate;
    if (room > roomiestHeight) {
      roomiest = candidate;
      roomiestHeight = room;
    }
    const box = panelBox(candidate, panelHeight, viewport);
    const overlap = avoid.reduce((sum, area) => sum + overlapArea(box, area), 0);
    if (overlap < leastOverlap) {
      leastCovering = candidate;
      leastOverlap = overlap;
    }
  }
  return roomiestHeight >= MIN_HEIGHT ? { ...roomiest, maxHeight: roomiestHeight } : leastCovering;
}

/** How tall the panel can grow from its anchored edge before it reaches a highlighted area. */
function clearHeight(placement: PanelPlacement, viewport: Viewport, avoid: readonly Box[]): number {
  const growsDown = "top" in placement;
  const edge = growsDown ? placement.top : viewport.height - placement.bottom;
  let room = placement.maxHeight;

  for (const area of avoid) {
    const beside =
      area.left >= placement.left + PANEL_WIDTH || area.left + area.width <= placement.left;
    const behind = growsDown ? area.top + area.height <= edge : area.top >= edge;
    if (beside || behind) continue;
    const distance = growsDown ? area.top - edge : edge - (area.top + area.height);
    room = Math.min(room, Math.max(0, distance - GAP));
  }
  return room;
}

/** Below the cursor in the top half of the screen and above it in the bottom half. */
function besideCursor({ x, y }: Point, viewport: Viewport): PanelPlacement {
  const left = Math.max(GAP, Math.min(x + GAP, viewport.width - PANEL_WIDTH - GAP));
  return y < viewport.height / 2
    ? { left, top: y + GAP, maxHeight: viewport.height - y - 2 * GAP }
    : { left, bottom: viewport.height - y + GAP, maxHeight: y - 2 * GAP };
}

function corners(viewport: Viewport): PanelPlacement[] {
  const right = Math.max(GAP, viewport.width - PANEL_WIDTH - GAP);
  const maxHeight = viewport.height - 2 * GAP;
  return [
    { left: right, top: GAP, maxHeight },
    { left: right, bottom: GAP, maxHeight },
    { left: GAP, top: GAP, maxHeight },
    { left: GAP, bottom: GAP, maxHeight },
  ];
}

function panelBox(placement: PanelPlacement, panelHeight: number, viewport: Viewport): Box {
  const height = Math.min(panelHeight, placement.maxHeight);
  const top = "top" in placement ? placement.top : viewport.height - placement.bottom - height;
  return { left: placement.left, top, width: PANEL_WIDTH, height };
}

function overlapArea(a: Box, b: Box): number {
  const width = Math.min(a.left + a.width, b.left + b.width) - Math.max(a.left, b.left);
  const height = Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top);
  return width > 0 && height > 0 ? width * height : 0;
}
