import type { NemuAction } from "@nemu/contracts";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { Box } from "../../../shared/types/box";
import { applyConfirmedFill, type FillAction, type FillElement } from "../lib/confirmed-fill";

export type FillHighlight = { action: NemuAction; box: Box };

export type ConfirmedFillControlModel =
  | { mode: "confirm"; action: FillAction; box: Box; confirm: () => void }
  | { mode: "mismatch"; action: FillAction; box: Box; message: string };

type AppliedFill = { action: FillAction; element: FillElement; box: Box };

function isFillAction(action: NemuAction): action is FillAction {
  return action.type === "fill";
}

function comparableValue(value: string): string {
  const digits = value.replace(/\D/gu, "").replace(/^0+(?=\d)/u, "");
  return digits || value.trim();
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

export function useConfirmedFill(
  actions: readonly NemuAction[],
  currentHighlight: FillHighlight | undefined,
): ConfirmedFillControlModel | undefined {
  const fills = useMemo(() => actions.filter(isFillAction), [actions]);
  const fillKey = fills.map(({ target, value }) => `${target}\u0000${value}`).join("\u0001");
  const [applied, setApplied] = useState<AppliedFill>();
  const [mismatch, setMismatch] = useState(false);

  useEffect(() => {
    setApplied(undefined);
    setMismatch(false);
  }, [fillKey]);

  useEffect(() => {
    if (!applied) return;
    const update = () => {
      setMismatch(comparableValue(applied.element.value) !== comparableValue(applied.action.value));
      setApplied((current) =>
        current ? { ...current, box: targetBox(current.action, current.element) } : current,
      );
    };
    applied.element.addEventListener("input", update);
    applied.element.addEventListener("change", update);
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      applied.element.removeEventListener("input", update);
      applied.element.removeEventListener("change", update);
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [applied?.action.target, applied?.action.value, applied?.element]);

  const currentFill = currentHighlight?.action;
  const confirm = useCallback(() => {
    if (!currentFill || !isFillAction(currentFill)) return;
    const result = applyConfirmedFill(currentFill);
    if (result.status === "applied") {
      setMismatch(false);
      setApplied({
        action: currentFill,
        element: result.element,
        box: targetBox(currentFill, result.element),
      });
    }
  }, [currentFill]);

  if (applied) {
    return mismatch
      ? {
          mode: "mismatch",
          action: applied.action,
          box: applied.box,
          message: mismatchMessage(applied.action),
        }
      : undefined;
  }

  return currentFill && isFillAction(currentFill)
    ? { mode: "confirm", action: currentFill, box: currentHighlight.box, confirm }
    : undefined;
}
