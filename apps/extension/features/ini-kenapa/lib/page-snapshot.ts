import type { PageField, PageSnapshot } from "@nemu/contracts/school";

import { accessibleName, isVisible } from "../../executor/lib/find-target";

/**
 * What the page shows, for "ini kenapa?" (#216): its title and address, alerts, toasts and error
 * messages, headings, and the choices made in its form fields. Read on the Nemu Service's
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

/**
 * Choices only: "Kelas: 4A", a ticked checkbox (#255). Typed fields (text, number, textarea,
 * contenteditable) are never read, since on Isi nilai they hold each pupil's grade and note.
 */
const FIELDS = "select, input[type=checkbox], input[type=radio]";

/** A table row is one record: its fields are labelled with a pupil's name ("Nilai Aisyah"). */
const RECORD_ROWS = "tr, [role=row]";

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

function fieldValue(element: Element): string {
  if (element instanceof HTMLSelectElement) return element.selectedOptions[0]?.text.trim() ?? "";
  return (element as HTMLInputElement).checked ? "dicentang" : "tidak dicentang";
}

function readFields(doc: Document): PageField[] {
  const fields: PageField[] = [];
  for (const element of visible(doc, FIELDS)) {
    if (element.closest(RECORD_ROWS)) continue;
    const label = accessibleName(element).slice(0, 300);
    if (!label) continue;
    fields.push({ label, value: fieldValue(element).slice(0, 500) });
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

/**
 * The messages on screen (alerts, toasts, errors), in page order: the outermost of nested ones
 * only, so one message isn't sent twice.
 */
export function readAlertElements(doc: Document): Element[] {
  const found = visible(doc, ALERTS);
  return found.filter(
    (element) => !found.some((other) => other !== element && other.contains(element)),
  );
}

function readAlerts(doc: Document): string[] {
  const texts = readAlertElements(doc)
    .map((element) => alertText(element).slice(0, 2_000))
    .filter(Boolean);
  return [...new Set(texts)].slice(0, MAX_ALERTS);
}

/** A message that says something went wrong, rather than a status such as "Nilai tersimpan". */
const PROBLEMS = [
  "[role=alert]",
  "[role=alertdialog]",
  "[aria-live=assertive]",
  ".alert",
  ".error",
  ".galat",
  ".invalid-feedback",
].join(", ");

/**
 * The message an "ini kenapa?" answer explains, for Nemu to point at (F2 · 02): of the messages
 * read when she asked, the first problem still on the page and in view, else the first message.
 * Null when none is left, so the answer sits above the Nemu button as before.
 */
export function messageToPoint(
  messages: readonly Element[],
  viewport: { width: number; height: number },
): Element | null {
  const shown = messages.filter((element) => {
    if (!element.isConnected || !isVisible(element)) return false;
    const { left, top, width, height } = element.getBoundingClientRect();
    return (
      width > 0 &&
      height > 0 &&
      left < viewport.width &&
      top < viewport.height &&
      left + width > 0 &&
      top + height > 0
    );
  });
  return shown.find((element) => element.matches(PROBLEMS)) ?? shown[0] ?? null;
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
