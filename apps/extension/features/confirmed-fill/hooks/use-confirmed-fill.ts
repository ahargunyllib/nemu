import type { NemuAction } from "@nemu/contracts";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { Box } from "../../../shared/types/box";
import {
  applyConfirmedFill,
  comparableFillValue,
  type FillAction,
  type FillElement,
  fillLabelMatchesValue,
  fillValueLabel,
} from "../lib/confirmed-fill";

export type FillHighlight = { action: NemuAction; box: Box };

/** The highlighted `fill` step, waiting for Rina to press Isi. */
export type PendingFill = { action: FillAction; value: string; confirm: () => void };

/** A fill Rina applied, and whether its field still holds that value. */
export type FillCheck = {
  action: FillAction;
  box: Box;
  value: string;
  matches: boolean;
  refill: () => void;
};

export type ConfirmedFills = { pending?: PendingFill; checks: FillCheck[] };

type AppliedFill = { action: FillAction; element: FillElement; box: Box; mismatch: boolean };

function isFillAction(action: NemuAction): action is FillAction {
  return action.type === "fill";
}

function targetBox(action: FillAction, element: FillElement): Box {
  const target = element.closest<HTMLElement>(`[data-nemu-id="${action.target}"]`) ?? element;
  const { left, top, width, height } = target.getBoundingClientRect();
  return { left, top, width, height };
}

/**
 * Offers the highlighted `fill` step for Rina to confirm with Isi and, once she has, checks
 * whether the field still holds that value, so it can be filled again. Every fill in the answer is
 * confirmed and watched on its own, so a second fill is still offered after the first was applied.
 */
export function useConfirmedFill(
  actions: readonly NemuAction[],
  currentHighlight: FillHighlight | undefined,
): ConfirmedFills {
  const fills = useMemo(() => actions.filter(isFillAction), [actions]);
  const fillKey = fills.map(({ target, value }) => `${target}\u0000${value}`).join("\u0001");
  const [applied, setApplied] = useState<readonly AppliedFill[]>([]);

  useEffect(() => {
    setApplied([]);
  }, [fillKey]);

  const appliedKey = applied.map(({ action }) => action.target).join("\u0001");
  useEffect(() => {
    const elements = applied.map(({ element }) => element);
    if (!elements.length) return;
    const update = () => {
      setApplied((current) =>
        current.map((fill) => ({
          ...fill,
          mismatch:
            comparableFillValue(fill.element.value) !== comparableFillValue(fill.action.value),
          box: targetBox(fill.action, fill.element),
        })),
      );
    };
    for (const element of elements) {
      element.addEventListener("input", update);
      element.addEventListener("change", update);
    }
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      for (const element of elements) {
        element.removeEventListener("input", update);
        element.removeEventListener("change", update);
      }
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
    // Re-subscribe only when a fill is applied, not on every box update.
  }, [appliedKey]);

  const apply = useCallback((action: FillAction) => {
    if (!fillLabelMatchesValue(action)) return;
    const result = applyConfirmedFill(action);
    if (result.status !== "applied") return;
    const fill: AppliedFill = {
      action,
      element: result.element,
      box: targetBox(action, result.element),
      mismatch: false,
    };
    setApplied((current) => [
      ...current.filter((entry) => entry.action.target !== action.target),
      fill,
    ]);
  }, []);

  const checks = applied.map(({ action, box, mismatch }): FillCheck => ({
    action,
    box,
    value: fillValueLabel(action),
    matches: !mismatch,
    refill: () => apply(action),
  }));

  const currentFill =
    currentHighlight && isFillAction(currentHighlight.action) ? currentHighlight.action : undefined;
  const alreadyApplied = applied.some(
    ({ action }) => action.target === currentFill?.target && action.value === currentFill.value,
  );
  const pending =
    currentFill && !alreadyApplied && fillLabelMatchesValue(currentFill)
      ? {
          action: currentFill,
          value: fillValueLabel(currentFill),
          confirm: () => apply(currentFill),
        }
      : undefined;

  return { pending, checks };
}
