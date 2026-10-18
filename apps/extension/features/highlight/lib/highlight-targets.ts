import type { NemuAction } from "@nemu/contracts";

import type { Box } from "../../../shared/types/box";

export type HighlightTarget = { action: NemuAction; element: HTMLElement };

/** Space around the element for the outline. */
export const RING_PADDING = 4;
/** The action label pill: its height, and room for a typical label, which can be wider than a
    small target such as a radio. */
export const LABEL_HEIGHT = 26;
const LABEL_WIDTH = 240;
/** Space between the outline and a label beside it. */
export const LABEL_GAP = 8;
/** How far a label pinned to the outline's edge overlaps it, and its inset from the right end. */
export const LABEL_OVERLAP = 8;
export const LABEL_INSET = 12;

/**
 * Finds the page element for each `highlight` and `confirm` action: a confirm is shown the same
 * way, a ring with its label, and the user presses it. A target missing from the page is reported
 * back, never thrown, so Nemu can warn about it.
 */
export function findHighlightTargets(
  actions: readonly NemuAction[],
  root: ParentNode = document,
): { found: HighlightTarget[]; missing: NemuAction[] } {
  const found: HighlightTarget[] = [];
  const missing: NemuAction[] = [];

  for (const action of actions) {
    if (action.type === "click") continue;
    // The contract limits a nemu_id to [a-zA-Z0-9:_-], so it is safe inside a quoted selector.
    const element = root.querySelector<HTMLElement>(`[data-nemu-id="${action.target}"]`);
    if (element) found.push({ action, element });
    else missing.push(action);
  }
  return { found, missing };
}

const FORM_FIELD = "input:not([type=hidden]), textarea, select";

/**
 * Whether the user just did the current step on its target: changed a field inside it, or pressed
 * a target that is a plain button or option. A click into a field, or on a control that opens a
 * popup such as a select, only starts the step.
 */
export function completesStep(event: Event, target: HTMLElement): boolean {
  if (event.type === "change") return true;
  if (event.type !== "click") return false;
  return (
    !target.matches(FORM_FIELD) &&
    !target.querySelector(FORM_FIELD) &&
    !target.closest("[aria-haspopup]")
  );
}

export function missingTargetWarning(action: NemuAction): string {
  return `Nemu tidak menemukan "${action.label}" (${action.target}) di halaman ini.`;
}

export type LabelSide = "right" | "top" | "bottom";

/**
 * Where the action label sits: to the right of the outline, level with its top, so it covers none
 * of the target. With no room on the right it falls back to the outline's top-right edge, or its
 * bottom-right edge near the top of the viewport.
 */
export function labelSide(box: Box, viewportWidth: number): LabelSide {
  const outlineRight = box.left + box.width + RING_PADDING;
  if (outlineRight + LABEL_GAP + LABEL_WIDTH <= viewportWidth) return "right";
  return box.top - RING_PADDING < LABEL_HEIGHT - LABEL_OVERLAP ? "bottom" : "top";
}

/** The area a highlight draws on: the element, its outline, and its label. */
export function highlightFootprint(box: Box, viewportWidth = window.innerWidth): Box {
  const outline = {
    left: box.left - RING_PADDING,
    top: box.top - RING_PADDING,
    width: box.width + 2 * RING_PADDING,
    height: box.height + 2 * RING_PADDING,
  };
  const side = labelSide(box, viewportWidth);
  if (side === "right") {
    return {
      ...outline,
      width: outline.width + LABEL_GAP + LABEL_WIDTH,
      height: Math.max(outline.height, LABEL_HEIGHT),
    };
  }

  // The label's right end is LABEL_INSET in from the outline's, and it grows to the left.
  const right = outline.left + outline.width;
  const left = Math.min(outline.left, right - LABEL_INSET - LABEL_WIDTH);
  const outside = LABEL_HEIGHT - LABEL_OVERLAP;
  return {
    left,
    top: side === "top" ? outline.top - outside : outline.top,
    width: right - left,
    height: outline.height + outside,
  };
}
