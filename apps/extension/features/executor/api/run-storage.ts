import { browser } from "wxt/browser";

/**
 * Background: the executor's run for each tab, and the last Catatan langkah, in
 * `chrome.storage.session` (F0-13). The content script reaches it only through messages, so the
 * page never sees the steps or their values; the browser drops it all when it closes.
 */
const runKey = (tabId: number) => `executor-run:${tabId}`;
const NOTES_KEY = "executor-notes";

export async function saveRun(tabId: number | undefined, state: unknown): Promise<void> {
  if (tabId === undefined) return;
  if (state === null) await browser.storage.session.remove(runKey(tabId));
  else await browser.storage.session.set({ [runKey(tabId)]: state });
}

export async function loadRun(tabId: number | undefined): Promise<unknown> {
  if (tabId === undefined) return null;
  return (await browser.storage.session.get(runKey(tabId)))[runKey(tabId)] ?? null;
}

export async function saveNotes(notes: { title: string; items: string[] }): Promise<void> {
  await browser.storage.session.set({ [NOTES_KEY]: notes });
}

export async function loadNotes(): Promise<{ title: string; items: string[] } | null> {
  return ((await browser.storage.session.get(NOTES_KEY))[NOTES_KEY] as never) ?? null;
}

/** A closed tab leaves no run behind. */
export function forgetClosedTabs() {
  browser.tabs.onRemoved.addListener((tabId) => {
    void browser.storage.session.remove(runKey(tabId));
  });
}
