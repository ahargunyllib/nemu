import { normalizeControlName } from "@nemu/ai/school/safety";

/**
 * What the executor does to a page element. Values are set and announced with input and change
 * events only: Nemu never dispatches a key, so it can never press Enter (F0-08).
 */

type ValueField = HTMLInputElement | HTMLTextAreaElement;

export function isValueField(element: Element): element is ValueField {
  return element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement;
}

/** Sets the value through the prototype's setter, so frameworks that track it see the change. */
function setNativeValue(field: ValueField, value: string) {
  const prototype =
    field instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  if (setter) setter.call(field, value);
  else field.value = value;
}

function announce(element: Element, type: "input" | "change", data?: string) {
  const event =
    type === "input"
      ? new InputEvent("input", { bubbles: true, inputType: "insertText", data: data ?? null })
      : new Event("change", { bubbles: true });
  element.dispatchEvent(event);
}

/** A value never carries a line break, so no field can turn it into a submit. */
export function cleanValue(value: string): string {
  return value.replace(/[\r\n]+/gu, " ").trim();
}

/**
 * Types the value one character at a time (cara 1: digits typed one by one), waiting between
 * characters with `pause`, which rejects when the run is interrupted.
 */
export async function typeValue(
  field: ValueField,
  value: string,
  pause: () => Promise<void>,
): Promise<void> {
  const text = cleanValue(value);
  setNativeValue(field, "");
  announce(field, "input");
  for (let end = 1; end <= text.length; end += 1) {
    await pause();
    setNativeValue(field, text.slice(0, end));
    announce(field, "input", text[end - 1]);
  }
  announce(field, "change");
}

/** The option whose text or value is `option`, normalized the same way as control names. */
export function findOption(select: HTMLSelectElement, option: string): HTMLOptionElement | null {
  const wanted = normalizeControlName(option);
  return (
    [...select.options].find(
      (candidate) =>
        normalizeControlName(candidate.text) === wanted ||
        normalizeControlName(candidate.value) === wanted,
    ) ?? null
  );
}

/** Picks an option of a native select; false when there is no such option or no select. */
export function chooseOption(element: Element, option: string): boolean {
  if (!(element instanceof HTMLSelectElement)) return false;
  const choice = findOption(element, option);
  if (!choice) return false;
  element.value = choice.value;
  announce(element, "input");
  announce(element, "change");
  return true;
}

export function isChecked(element: Element): boolean {
  if (element instanceof HTMLInputElement) return element.checked;
  return element.getAttribute("aria-checked") === "true";
}

/** Ticks or unticks a checkbox the way a click would, only when it isn't already so. */
export function setChecked(element: Element, checked: boolean) {
  if (isChecked(element) !== checked && element instanceof HTMLElement) element.click();
}

/** The value a field shows now, as the executor compares it with what it should be. */
export function currentValue(element: Element): string {
  if (element instanceof HTMLSelectElement)
    return element.selectedOptions[0]?.text ?? element.value;
  if (isValueField(element)) return element.value;
  return element.textContent ?? "";
}

export function sameValue(actual: string, expected: string): boolean {
  return normalizeControlName(actual) === normalizeControlName(cleanValue(expected));
}

export function bringIntoView(element: Element) {
  const { top, bottom } = element.getBoundingClientRect();
  if (top < 0 || bottom > window.innerHeight)
    element.scrollIntoView({ block: "center", behavior: "instant" });
}
