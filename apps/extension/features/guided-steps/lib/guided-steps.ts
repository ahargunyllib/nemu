import type { NemuAction } from "@nemu/contracts";

import type { Box } from "../../../shared/types/box";
import { LABEL_SPACE, RING_PADDING } from "../../highlight/lib/highlight-targets";

/** The step card is about 280 px wide (docs/design-system.md, "Guided steps"). */
export const STEP_CARD_WIDTH = 280;
/** How long the mascot shows success on a done step before the next one starts. */
export const DONE_MS = 900;
/** The gap between the target's outline (or its label) and the step card. */
const GAP = 12;
/** The least room kept between the step card and the viewport's edges. */
const EDGE = 16;

/**
 * Whether an answer runs as guided steps: one of its `highlight` or `confirm` actions carries a
 * note for a step card. Such an answer shows no Answer Card.
 */
export function isGuided(actions: readonly NemuAction[]): boolean {
  return actions.some((action) => action.type !== "click" && action.note !== undefined);
}

export type NoteSegment = { text: string; bold: boolean };

/** Splits a step note into plain and `**bold**` runs; an unpaired `**` stays as written. */
export function noteSegments(note: string): NoteSegment[] {
  const segments: NoteSegment[] = [];
  const bold = /\*\*(.+?)\*\*/g;
  let last = 0;
  for (const match of note.matchAll(bold)) {
    if (match.index > last) segments.push({ text: note.slice(last, match.index), bold: false });
    segments.push({ text: match[1] ?? "", bold: true });
    last = match.index + match[0].length;
  }
  if (last < note.length) segments.push({ text: note.slice(last), bold: false });
  return segments;
}

/**
 * Where the step card goes beside a target, in viewport coordinates: below the outline, or above
 * it when there isn't room below, clear of the label either way, so it never covers the field. It lines up with the target's left edge and stays inside the viewport.
 */
export function placeStepCard(
  target: Box,
  viewport: { width: number; height: number },
  cardHeight: number,
): Box {
  // Near the viewport's top the label moves to the outline's bottom edge, so the card clears it.
  const labelBelow = target.top - RING_PADDING < LABEL_SPACE;
  const below = target.top + target.height + RING_PADDING + (labelBelow ? LABEL_SPACE : 0) + GAP;
  const above = target.top - RING_PADDING - LABEL_SPACE - GAP - cardHeight;
  const fitsBelow = below + cardHeight <= viewport.height - EDGE;
  const top = fitsBelow || above < EDGE ? below : above;
  const left = Math.min(
    Math.max(EDGE, target.left - RING_PADDING),
    viewport.width - STEP_CARD_WIDTH - EDGE,
  );
  return { left: Math.max(EDGE, left), top, width: STEP_CARD_WIDTH, height: cardHeight };
}
