import type { PageField, PageSnapshot } from "@nemu/contracts/school";

import { accessibleName, isVisible } from "../../executor/lib/find-target";

/**
 * What the page shows, for "ini kenapa?" (#216): its title and address, alerts, toasts and error
 * messages, headings, and form fields with the value each one shows. Read on the Nemu Service's
 * behalf only on WS-03 sites, since the content script stops before mounting anywhere else. The
 * viewport screenshot is added by the background (`captureVisibleTab`).
 */

const ALERTS = [
  "[role=alert]",
  "[role=alertdialog]",
  "[role=status]",
  "[aria-live=assertive]",
  "[aria-live=polite]",
  ".toast",
  ".alert",
  ".error",
  ".galat",
  ".invalid-feedback",
].join(", ");

const HEADINGS = "h1, h2, h3, h4, [role=heading]";

const FIELDS = [
  "input",
  "select",
  "textarea",
  "[role=textbox]",
  "[role=combobox]",
  "[contenteditable=true]",
].join(", ");

/** Input types that show no value of their own, or one Nemu must never read. */
const SKIPPED_INPUTS = new Set([
  "password",
  "hidden",
  "submit",
  "button",
  "reset",
  "image",
  "file",
]);

const MAX_ALERTS = 30;
const MAX_HEADINGS = 50;
const MAX_FIELDS = 150;

function textOf(element: Element): string {
  const text = element instanceof HTMLElement ? element.innerText : element.textContent;
  return (text ?? element.textContent ?? "").replace(/\s+/gu, " ").trim();
}

function visible(doc: Document, selector: string): Element[] {
  return [...doc.querySelectorAll(selector)].filter((element) => isVisible(element));
}

/** A password field on screen: nothing at all is read or sent from the page (F2-07). */
export function hasPasswordOnScreen(doc: Document): boolean {
  return visible(doc, "input[type=password]").length > 0;
}

function fieldValue(element: Element): string | null {
  if (element instanceof HTMLInputElement) {
    if (SKIPPED_INPUTS.has(element.type)) return null;
    if (element.type === "checkbox" || element.type === "radio")
      return element.checked ? "dicentang" : "tidak dicentang";
    return element.value;
  }
  if (element instanceof HTMLSelectElement) return element.selectedOptions[0]?.text.trim() ?? "";
  if (element instanceof HTMLTextAreaElement) return element.value;
  return textOf(element);
}

function readFields(doc: Document): PageField[] {
  const fields: PageField[] = [];
  for (const element of visible(doc, FIELDS)) {
    const value = fieldValue(element);
    const label = accessibleName(element).slice(0, 300);
    if (value === null || !label) continue;
    fields.push({ label, value: value.trim().slice(0, 500) });
    if (fields.length >= MAX_FIELDS) break;
  }
  return fields;
}

/** An alert's lines as sentences: "Tidak dapat menampilkan siswa. Anda belum ditugaskan …". */
function alertText(element: Element): string {
  const raw = element instanceof HTMLElement ? element.innerText : (element.textContent ?? "");
  const lines = raw
    .split(/\n+/u)
    .map((line) => line.replace(/\s+/gu, " ").trim())
    .filter(Boolean);
  return lines
    .map((line, at) => (at < lines.length - 1 && !/[.!?:;]$/u.test(line) ? `${line}.` : line))
    .join(" ");
}

/** The outermost of nested alerts only, so one message isn't sent twice. */
function readAlerts(doc: Document): string[] {
  const found = visible(doc, ALERTS);
  const outermost = found.filter(
    (element) => !found.some((other) => other !== element && other.contains(element)),
  );
  const texts = outermost.map((element) => alertText(element).slice(0, 2_000)).filter(Boolean);
  return [...new Set(texts)].slice(0, MAX_ALERTS);
}

/** The page as Nemu may send it, or null while a password field is on screen. */
export function readPageSnapshot(doc: Document, url: string): PageSnapshot | null {
  if (hasPasswordOnScreen(doc)) return null;
  const headings = visible(doc, HEADINGS)
    .map((element) => textOf(element).slice(0, 300))
    .filter(Boolean);
  return {
    title: doc.title.slice(0, 500),
    url: url.slice(0, 2_000),
    alerts: readAlerts(doc),
    headings: [...new Set(headings)].slice(0, MAX_HEADINGS),
    fields: readFields(doc),
    screenshotBase64: null,
  };
}
