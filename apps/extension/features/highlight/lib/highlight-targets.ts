import type { NemuAction } from "@nemu/contracts";

import type { Box } from "../../../shared/types/box";

export type HighlightTarget = { action: NemuAction; element: HTMLElement };

/** Space around the element for the outline, and above or below it for the action label. */
export const RING_PADDING = 4;
export const LABEL_SPACE = 28;
/** Room for a typical action label, which can be wider than a small target such as a radio. */
const LABEL_WIDTH = 200;

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

/**
 * Calls `onPick` once the user picks a value in a popup control on the target, such as the Demo
 * App's Select: it fires no change event on its trigger, so the step is done when the value the
 * trigger shows changes. Targets without a popup control are left to `completesStep`. Returns
 * the cleanup.
 */
export function watchPick(target: HTMLElement, onPick: () => void): () => void {
  if (!target.matches("[aria-haspopup]") && !target.querySelector("[aria-haspopup]")) {
    return () => {};
  }
  const shown = target.textContent;
  const observer = new MutationObserver(() => {
    if (target.textContent !== shown) onPick();
  });
  observer.observe(target, { subtree: true, childList: true, characterData: true });
  return () => observer.disconnect();
}

export function missingTargetWarning(action: NemuAction): string {
  return `Nemu tidak menemukan "${action.label}" (${action.target}) di halaman ini.`;
}

/**
 * Whether a label wider than its target grows to the left, past the outline's left edge, because
 * growing to the right would run it off the viewport. Otherwise it grows to the right.
 */
export function labelGrowsLeft(box: Box, viewportWidth: number): boolean {
  return box.left - RING_PADDING + LABEL_WIDTH > viewportWidth;
}

/** The area a highlight draws on: the element, its outline, and its label on either side. */
export function highlightFootprint(box: Box, viewportWidth = window.innerWidth): Box {
  const width = Math.max(box.width + 2 * RING_PADDING, LABEL_WIDTH);
  const right = box.left + box.width + RING_PADDING;
  return {
    left: labelGrowsLeft(box, viewportWidth) ? right - width : box.left - RING_PADDING,
    top: box.top - RING_PADDING - LABEL_SPACE,
    width,
    height: box.height + 2 * (RING_PADDING + LABEL_SPACE),
  };
}
