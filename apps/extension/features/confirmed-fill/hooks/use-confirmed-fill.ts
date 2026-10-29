import type { NemuAction } from "@nemu/contracts";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { Box } from "../../../shared/types/box";
import {
  applyConfirmedFill,
  comparableFillValue,
  type FillAction,
  type FillElement,
  fillLabelMatchesValue,
} from "../lib/confirmed-fill";

export type FillHighlight = { action: NemuAction; box: Box };

export type ConfirmedFillControlModel =
  | { mode: "confirm"; action: FillAction; box: Box; confirm: () => void }
  | { mode: "mismatch"; action: FillAction; box: Box; message: string };

type AppliedFill = { action: FillAction; element: FillElement; box: Box; mismatch: boolean };

function isFillAction(action: NemuAction): action is FillAction {
  return action.type === "fill";
}

function targetBox(action: FillAction, element: FillElement): Box {
  const target = element.closest<HTMLElement>(`[data-nemu-id="${action.target}"]`) ?? element;
  const { left, top, width, height } = target.getBoundingClientRect();
  return { left, top, width, height };
}

function mismatchMessage(action: FillAction): string {
  const expected = action.label.startsWith("Isi ") ? action.label.slice(4) : action.value;
  return `Tidak sesuai hitungan ${expected}`;
}

/**
 * Offers the Isi button for the highlighted `fill` step and, once Rina has pressed it, warns when
 * the field no longer holds that value. Every fill in the answer is confirmed and watched on its
 * own, so a second fill still gets its button after the first was applied.
 */
export function useConfirmedFill(
  actions: readonly NemuAction[],
  currentHighlight: FillHighlight | undefined,
): ConfirmedFillControlModel[] {
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

  const currentFill =
    currentHighlight && isFillAction(currentHighlight.action) ? currentHighlight.action : undefined;
  const confirm = useCallback(() => {
    if (!currentFill || !fillLabelMatchesValue(currentFill)) return;
    const result = applyConfirmedFill(currentFill);
    if (result.status !== "applied") return;
    const fill: AppliedFill = {
      action: currentFill,
      element: result.element,
      box: targetBox(currentFill, result.element),
      mismatch: false,
    };
    setApplied((current) => [
      ...current.filter(({ action }) => action.target !== currentFill.target),
      fill,
    ]);
  }, [currentFill]);

  const controls: ConfirmedFillControlModel[] = applied
    .filter(({ mismatch }) => mismatch)
    .map(({ action, box }) => ({
      mode: "mismatch",
      action,
      box,
      message: mismatchMessage(action),
    }));

  const alreadyApplied = applied.some(
    ({ action }) => action.target === currentFill?.target && action.value === currentFill.value,
  );
  if (currentHighlight && currentFill && !alreadyApplied && fillLabelMatchesValue(currentFill)) {
    controls.push({ mode: "confirm", action: currentFill, box: currentHighlight.box, confirm });
  }
  return controls;
}
