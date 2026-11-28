import { browser } from "wxt/browser";

import { withNotes } from "../lib/kept-notes";
import type { StepNotes } from "./request-run-storage";

/**
 * Background: the executor's run for each tab, and each site's last few Catatan langkah, in
 * `chrome.storage.session` (F0-13). The content script reaches it only through messages, so the
 * page never sees the steps or their values; the browser drops it all when it closes.
 */
const runKey = (tabId: number) => `executor-run:${tabId}`;
const notesKey = (site: string) => `executor-notes:${site}`;

export async function saveRun(tabId: number | undefined, state: unknown): Promise<void> {
  if (tabId === undefined) return;
  if (state === null) await browser.storage.session.remove(runKey(tabId));
  else await browser.storage.session.set({ [runKey(tabId)]: state });
}

export async function loadRun(tabId: number | undefined): Promise<unknown> {
  if (tabId === undefined) return null;
  return (await browser.storage.session.get(runKey(tabId)))[runKey(tabId)] ?? null;
}

/** Adds the notes a task just ended with to its site's kept notes (`withNotes`). */
export async function saveNotes(site: string, notes: StepNotes): Promise<void> {
  await browser.storage.session.set({ [notesKey(site)]: withNotes(await loadNotes(site), notes) });
}

/** The site's kept notes, newest first. */
export async function loadNotes(site: string): Promise<StepNotes[]> {
  const kept = (await browser.storage.session.get(notesKey(site)))[notesKey(site)];
  return Array.isArray(kept) ? (kept as StepNotes[]) : [];
}

/** A closed tab leaves no run behind. */
export function forgetClosedTabs() {
  browser.tabs.onRemoved.addListener((tabId) => {
    void browser.storage.session.remove(runKey(tabId));
  });
}
