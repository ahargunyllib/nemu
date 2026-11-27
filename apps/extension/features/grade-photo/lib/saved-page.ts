import type { GradeEntry, ReadbackRow } from "@nemu/contracts/school";

import { currentValue } from "../../executor/lib/page-actions";
import { findTarget } from "../../executor/lib/find-target";

/**
 * After the teacher presses Simpan (and confirms), the page says the grades are saved: the mock's
 * "Nilai tersimpan." toast, or a similar status or alert on AlurSekolah. Nemu waits for that
 * message before reading the grades back (F1-10).
 */
const MESSAGES = "[role=status], [role=alert], .toast, .alert, .notification, .swal2-popup";
const SAVED = /\b(tersimpan|berhasil disimpan|berhasil menyimpan)\b/iu;
const NOT_SAVED = /\b(belum tersimpan|gagal|tidak dapat|tidak bisa)\b/iu;

export function isSavedMessage(text: string): boolean {
  return SAVED.test(text) && !NOT_SAVED.test(text);
}

function savedMessages(doc: Document): Map<Element, string> {
  const found = new Map<Element, string>();
  for (const element of doc.querySelectorAll(MESSAGES)) {
    const text = (element.textContent ?? "").replace(/\s+/gu, " ").trim();
    if (isSavedMessage(text)) found.set(element, text);
  }
  return found;
}

/**
 * Resolves once a saved message appears that wasn't on the page when watching began. With
 * `acceptPresent` (after a page load, when the save already happened) one already there counts.
 * The returned function stops watching.
 */
export function watchForSave(
  doc: Document,
  onSaved: () => void,
  options: { acceptPresent?: boolean } = {},
): () => void {
  const before = options.acceptPresent ? new Map<Element, string>() : savedMessages(doc);
  let done = false;
  const check = () => {
    if (done) return;
    for (const [element, text] of savedMessages(doc)) {
      if (before.get(element) === text) continue;
      done = true;
      observer.disconnect();
      onSaved();
      return;
    }
  };
  const observer = new MutationObserver(check);
  observer.observe(doc.body, { childList: true, subtree: true, characterData: true });
  check();
  return () => {
    done = true;
    observer.disconnect();
  };
}

/**
 * The grades the page shows for each student after the save, read the way the executor found
 * the fields (row = name, column = Nilai). The fallback read-back when the school hasn't
 * connected AlurSekolah's API in WS-07.
 */
export function gradesOnPage(doc: Document, entries: readonly GradeEntry[]): ReadbackRow[] {
  return entries.flatMap((entry) => {
    const lookup = findTarget(doc, { row: entry.name, column: "Nilai", role: "textbox" });
    if (lookup.status !== "found") return [];
    return [{ name: entry.name, value: currentValue(lookup.element).trim() }];
  });
}
