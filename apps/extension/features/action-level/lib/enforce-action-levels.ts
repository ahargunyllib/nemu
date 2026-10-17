import type { NemuAction, PageElement } from "@nemu/contracts";

import { actionLevelOf } from "./action-level-config";

/**
 * Applies the bundled Action Levels to an answer's actions before any of them runs (ADR-0002).
 * A `click` survives only when its target is Jalan sendiri in the config and was in the Element
 * List sent with the prompt; every other click becomes a highlight on the same target, so Nemu
 * points at it and the user decides. Highlights and confirms pass through unchanged.
 */
export function enforceActionLevels(
  actions: readonly NemuAction[],
  elementList: readonly PageElement[],
): NemuAction[] {
  const listed = new Set(elementList.map((element) => element.nemu_id));

  return actions.map((action) => {
    if (action.type !== "click") return action;
    if (actionLevelOf(action.target) === "jalan_sendiri" && listed.has(action.target)) {
      return action;
    }
    return asHighlight(action);
  });
}

/** The highlight Nemu shows instead of a click it won't or couldn't make. */
export function asHighlight(action: NemuAction): NemuAction {
  return { ...action, type: "highlight", level: "arahkan" };
}
