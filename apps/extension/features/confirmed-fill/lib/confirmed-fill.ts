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

const MONTH_PREFIXES = [
  "jan",
  "feb",
  "mar",
  "apr",
  "mei",
  "jun",
  "jul",
  "agu",
  "sep",
  "okt",
  "nov",
  "des",
] as const;

/** A calendar date as yyyy-mm-dd, from "08/10/2026", "2026-10-08", or "8 Okt 2026". */
function calendarDate(value: string): string | undefined {
  const text = value.trim();
  const iso = (year: string, month: string | number, day: string) =>
    `${year}-${String(month).padStart(2, "0")}-${day.padStart(2, "0")}`;
  const dayMonthYear = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/u);
  if (dayMonthYear) return iso(dayMonthYear[3]!, dayMonthYear[2]!, dayMonthYear[1]!);
  const yearMonthDay = text.match(/^(\d{4})-(\d{2})-(\d{2})$/u);
  if (yearMonthDay) return text;
  const named = text.match(/^(\d{1,2}) (\p{L}+) (\d{4})$/u);
  const month = named
    ? MONTH_PREFIXES.findIndex((prefix) => named[2]!.toLowerCase().startsWith(prefix))
    : -1;
  return named && month >= 0 ? iso(named[3]!, month + 1, named[1]!) : undefined;
}

/**
 * The value to compare: a date as yyyy-mm-dd, so "8 Okt 2026" and "08/10/2026" compare equal;
 * otherwise digits only, without leading zeros, so "Rp447.000" and "447000" do.
 */
export function comparableFillValue(value: string): string {
  const date = calendarDate(value);
  if (date) return date;
  const digits = value.replace(/\D/gu, "").replace(/^0+(?=\d)/u, "");
  return digits || value.trim();
}

/** The value as the fill's label names it: "Rp447.000" from "Isi Rp447.000". */
export function fillValueLabel({ label, value }: FillAction): string {
  return label.startsWith("Isi ") ? label.slice(4) : value;
}

/**
 * The Isi button shows `label` but writes `value`, so a fill is offered only when its label names
 * that value: the same date, the same digits for an amount, the value itself for text.
 */
export function fillLabelMatchesValue({ label, value }: FillAction): boolean {
  const named = label.startsWith("Isi ") ? label.slice(4) : label;
  return /\d/u.test(value)
    ? comparableFillValue(named) === comparableFillValue(value)
    : label.includes(value.trim());
}
