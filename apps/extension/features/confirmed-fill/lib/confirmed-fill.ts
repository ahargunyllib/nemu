import type { NemuAction } from "@nemu/contracts";

export type FillAction = Extract<NemuAction, { type: "fill" }>;
export type FillElement = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
export type FillResult =
  | { status: "applied"; element: FillElement }
  | { status: "missing" | "unsupported" };

const EDITABLE_FIELD = "input:not([type=hidden]), textarea, select";

function fillElement(target: HTMLElement): FillElement | undefined {
  const candidate = target.matches(EDITABLE_FIELD)
    ? target
    : target.querySelector<HTMLElement>(EDITABLE_FIELD);
  return candidate instanceof HTMLInputElement ||
    candidate instanceof HTMLTextAreaElement ||
    candidate instanceof HTMLSelectElement
    ? candidate
    : undefined;
}

function nativeValueSetter(
  element: FillElement,
): ((this: FillElement, value: string) => void) | undefined {
  const prototype =
    element instanceof HTMLInputElement
      ? HTMLInputElement.prototype
      : element instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLSelectElement.prototype;
  return Object.getOwnPropertyDescriptor(prototype, "value")?.set;
}

export function findConfirmedFillElement(
  action: FillAction,
  root: ParentNode = document,
): FillElement | undefined {
  const target = root.querySelector<HTMLElement>(`[data-nemu-id="${action.target}"]`);
  return target ? fillElement(target) : undefined;
}

export function applyConfirmedFill(action: FillAction, root: ParentNode = document): FillResult {
  const target = root.querySelector<HTMLElement>(`[data-nemu-id="${action.target}"]`);
  if (!target) return { status: "missing" };

  const element = fillElement(target);
  const setValue = element && nativeValueSetter(element);
  if (!element || !setValue || element.disabled || ("readOnly" in element && element.readOnly)) {
    return { status: "unsupported" };
  }

  setValue.call(element, action.value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
  return { status: "applied", element };
}
