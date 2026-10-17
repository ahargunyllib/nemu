import type { NemuAction } from "@nemu/contracts";

import type { Box } from "../../../shared/types/box";

export type HighlightTarget = { action: NemuAction; element: HTMLElement };

/** Space around the element for the outline, and above or below it for the action label. */
export const RING_PADDING = 4;
export const LABEL_SPACE = 28;
/** Room for a typical action label, which can be wider than a small target such as a radio. */
const LABEL_WIDTH = 160;

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

export function missingTargetWarning(action: NemuAction): string {
  return `Nemu tidak menemukan "${action.label}" (${action.target}) di halaman ini.`;
}

/** The area a highlight draws on: the element, its outline, and its label on either side. */
export function highlightFootprint(box: Box): Box {
  return {
    left: box.left - RING_PADDING,
    top: box.top - RING_PADDING - LABEL_SPACE,
    width: Math.max(box.width + 2 * RING_PADDING, LABEL_WIDTH),
    height: box.height + 2 * (RING_PADDING + LABEL_SPACE),
  };
}
