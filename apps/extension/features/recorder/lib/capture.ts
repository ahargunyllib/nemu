import type { RecordedEvent } from "@nemu/contracts/school";

import { accessibleName } from "../../executor/lib/find-target";

/**
 * F3-01 "Rekam cara": what the operator does on the page, as the locators a person would name
 * (role, label, text), never pixels and never a password's value. Clicks on Nemu's own overlay,
 * script-made events and clicks on plain text are left out.
 */

const INTERACTIVE =
  "a[href], button, input, select, textarea, summary, [role=button], [role=link], [role=menuitem], [role=tab], [role=checkbox], [role=radio], [role=combobox], [role=option], [role=textbox]";

const TEXT_TYPES = new Set(["", "text", "number", "date", "email", "tel", "search", "url", "time"]);

export function roleOf(element: Element): string | null {
  const explicit = element.getAttribute("role");
  if (explicit) return explicit;
  if (element instanceof HTMLAnchorElement) return "link";
  if (element instanceof HTMLButtonElement || element instanceof HTMLElement && element.tagName === "SUMMARY")
    return "button";
  if (element instanceof HTMLSelectElement) return "combobox";
  if (element instanceof HTMLTextAreaElement) return "textbox";
  if (element instanceof HTMLInputElement) {
    if (["button", "submit", "reset"].includes(element.type)) return "button";
    if (element.type === "checkbox") return "checkbox";
    if (element.type === "radio") return "radio";
    if (TEXT_TYPES.has(element.type)) return "textbox";
  }
  return null;
}

export function isPassword(element: Element): boolean {
  return element instanceof HTMLInputElement && element.type === "password";
}

export function locatorFor(element: Element): RecordedEvent["locator"] {
  const name = accessibleName(element) || null;
  const field =
    element instanceof HTMLInputElement ||
    element instanceof HTMLSelectElement ||
    element instanceof HTMLTextAreaElement;
  return {
    role: roleOf(element),
    name,
    label: field ? name : (name ?? null),
    placeholder: element.getAttribute("placeholder"),
    css: element.id ? `#${CSS.escape(element.id)}` : null,
    relX: null,
    relY: null,
  };
}

function valueOf(element: Element): string | null {
  if (isPassword(element)) return null;
  if (element instanceof HTMLSelectElement) return element.selectedOptions[0]?.text.trim() ?? element.value;
  if (element instanceof HTMLInputElement && (element.type === "checkbox" || element.type === "radio"))
    return element.checked ? "ya" : "tidak";
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) return element.value;
  return null;
}

/** The element an event is about, or null when it is Nemu's own or nothing a person would name. */
export function eventTarget(event: Event): Element | null {
  const target = event.target instanceof Element ? event.target : null;
  if (!target || target.closest("nemu-overlay")) return null;
  return target.closest(INTERACTIVE);
}

/** One captured event, or null when it isn't one to keep. */
export function toRecordedEvent(
  event: Event,
  t: number,
  url: string,
  trusted: (event: Event) => boolean = (candidate) => candidate.isTrusted,
): RecordedEvent | null {
  if (!trusted(event)) return null;
  const element = eventTarget(event);
  if (!element) return null;
  const locator = locatorFor(element);
  if (event.type === "click") {
    if (!locator.name && !locator.css) return null;
    return { t, type: "click", url, locator, value: null };
  }
  if (event.type === "input" || event.type === "change") {
    // A password's value is never kept, not even as "changed".
    if (isPassword(element)) return { t, type: event.type, url, locator, value: null };
    return { t, type: event.type, url, locator, value: valueOf(element) };
  }
  return null;
}

/** Listens until the returned function is called; `t` is ms since `startedAt` (Date.now clock). */
export function captureEvents(
  doc: Document,
  startedAt: number,
  onEvent: (event: RecordedEvent) => void,
  trusted?: (event: Event) => boolean,
): () => void {
  const listener = (event: Event) => {
    const recorded = toRecordedEvent(
      event,
      Date.now() - startedAt,
      doc.location?.href ?? "",
      trusted,
    );
    if (recorded) onEvent(recorded);
  };
  const types = ["click", "input", "change"] as const;
  for (const type of types) doc.addEventListener(type, listener, true);
  return () => {
    for (const type of types) doc.removeEventListener(type, listener, true);
  };
}
