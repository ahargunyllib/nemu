import type { Box } from "../../../shared/types/box";
import { CARD_CORNER_REACH } from "../../mascot/lib/mascot-position";

export const PANEL_WIDTH = 280;
const GAP = 12;

export type Point = { x: number; y: number };
export type Viewport = { width: number; height: number };

/** Where the Composer and Answer Card panel sits: anchored by its top or, growing upward, its bottom. */
export type PanelPlacement = { left: number; maxHeight: number } & (
  | { top: number }
  | { bottom: number }
);

/**
 * What the panel is placed from: the active highlight's footprint while a step is highlighted, or
 * otherwise the point the Composer opened at.
 */
export type PanelAnchor = { target: Box } | { cursor: Point };

/** Shrinking the panel to scroll in less room than this hides too much of it to be worth it. */
const MIN_HEIGHT = 160;

/**
 * Places the panel from `anchor`, covering none of `avoid`. `width` is PANEL_WIDTH unless something
 * in the panel, such as the Composer, is wider.
 *
 * At a target, the panel sits right next to it with the mascot at its top-left corner: just above
 * it, its right end level with the target's (where the label is), so it covers only what comes
 * before the target; with no room above, below it; then beside it. It never covers the target.
 *
 * Without a target, the panel opens beside the cursor, unless that covers something to avoid; then
 * it moves to the first viewport corner that covers nothing.
 *
 * When the panel is too tall for every spot, it takes the spot with the most clear room and shrinks
 * to it, scrolling, rather than covering. Only when no spot has usable room does it cover, and then
 * as little as possible.
 */
export function placePanel(
  anchor: PanelAnchor,
  viewport: Viewport,
  panelHeight: number,
  avoid: readonly Box[],
  width = PANEL_WIDTH,
): PanelPlacement {
  if ("cursor" in anchor) {
    const candidates = [besideCursor(anchor.cursor, viewport, width), ...corners(viewport, width)];
    return pick(candidates, viewport, panelHeight, avoid, width);
  }

  // The mascot hangs off the panel's top-left corner, so the two are placed as one box.
  const reach = CARD_CORNER_REACH;
  const withMascot = pick(
    besideTarget(anchor.target, viewport, panelHeight + reach, width + reach),
    viewport,
    panelHeight + reach,
    [anchor.target, ...avoid],
    width + reach,
  );
  return "top" in withMascot
    ? {
        left: withMascot.left + reach,
        top: withMascot.top + reach,
        maxHeight: withMascot.maxHeight - reach,
      }
    : { ...withMascot, left: withMascot.left + reach, maxHeight: withMascot.maxHeight - reach };
}

/** The box the panel covers on screen once placed, at its measured height. */
export function panelBox(
  placement: PanelPlacement,
  panelHeight: number,
  viewport: Viewport,
  width = PANEL_WIDTH,
): Box {
  const height = Math.min(panelHeight, placement.maxHeight);
  const top = "top" in placement ? placement.top : viewport.height - placement.bottom - height;
  return { left: placement.left, top, width, height };
}

/** The first candidate the whole panel fits in; failing that, the roomiest or least covering. */
function pick(
  candidates: readonly PanelPlacement[],
  viewport: Viewport,
  panelHeight: number,
  avoid: readonly Box[],
  width: number,
): PanelPlacement {
  const [first] = candidates;
  if (!first) throw new Error("placePanel needs a candidate spot");
  let roomiest = first;
  let roomiestHeight = 0;
  let leastCovering = first;
  let leastOverlap = Number.POSITIVE_INFINITY;

  for (const candidate of candidates) {
    const room = clearHeight(candidate, viewport, avoid, width);
    if (room >= panelHeight) return candidate;
    if (room > roomiestHeight) {
      roomiest = candidate;
      roomiestHeight = room;
    }
    const box = panelBox(candidate, panelHeight, viewport, width);
    const overlap = avoid.reduce((sum, area) => sum + overlapArea(box, area), 0);
    if (overlap < leastOverlap) {
      leastCovering = candidate;
      leastOverlap = overlap;
    }
  }
  return roomiestHeight >= MIN_HEIGHT ? { ...roomiest, maxHeight: roomiestHeight } : leastCovering;
}

/** How tall the panel can grow from its anchored edge before it reaches an area to avoid. */
function clearHeight(
  placement: PanelPlacement,
  viewport: Viewport,
  avoid: readonly Box[],
  width: number,
): number {
  const growsDown = "top" in placement;
  const edge = growsDown ? placement.top : viewport.height - placement.bottom;
  let room = placement.maxHeight;

  for (const area of avoid) {
    const beside = area.left >= placement.left + width || area.left + area.width <= placement.left;
    const behind = growsDown ? area.top + area.height <= edge : area.top >= edge;
    if (beside || behind) continue;
    const distance = growsDown ? area.top - edge : edge - (area.top + area.height);
    room = Math.min(room, Math.max(0, distance - GAP));
  }
  return room;
}

/**
 * Above the target, then below it, each with its right end level with the target's; then to its
 * right and to its left, level with its top as far as the viewport allows.
 */
function besideTarget(
  target: Box,
  viewport: Viewport,
  panelHeight: number,
  width: number,
): PanelPlacement[] {
  const right = target.left + target.width;
  const bottom = target.top + target.height;
  const aligned = clamp(right - width, GAP, viewport.width - width - GAP);
  const top = clamp(target.top, GAP, viewport.height - panelHeight - GAP);
  const sides = [right + GAP, target.left - GAP - width].filter(
    (left) => left >= GAP && left + width <= viewport.width - GAP,
  );
  return [
    {
      left: aligned,
      bottom: viewport.height - target.top + GAP,
      maxHeight: Math.max(0, target.top - 2 * GAP),
    },
    {
      left: aligned,
      top: bottom + GAP,
      maxHeight: Math.max(0, viewport.height - bottom - 2 * GAP),
    },
    ...sides.map((left) => ({ left, top, maxHeight: viewport.height - top - GAP })),
  ];
}

/** Below the cursor in the top half of the screen and above it in the bottom half. */
function besideCursor({ x, y }: Point, viewport: Viewport, width: number): PanelPlacement {
  const left = Math.max(GAP, Math.min(x + GAP, viewport.width - width - GAP));
  return y < viewport.height / 2
    ? { left, top: y + GAP, maxHeight: viewport.height - y - 2 * GAP }
    : { left, bottom: viewport.height - y + GAP, maxHeight: y - 2 * GAP };
}

function corners(viewport: Viewport, width: number): PanelPlacement[] {
  const right = Math.max(GAP, viewport.width - width - GAP);
  const maxHeight = viewport.height - 2 * GAP;
  return [
    { left: right, top: GAP, maxHeight },
    { left: right, bottom: GAP, maxHeight },
    { left: GAP, top: GAP, maxHeight },
    { left: GAP, bottom: GAP, maxHeight },
  ];
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

function overlapArea(a: Box, b: Box): number {
  const width = Math.min(a.left + a.width, b.left + b.width) - Math.max(a.left, b.left);
  const height = Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top);
  return width > 0 && height > 0 ? width * height : 0;
}
