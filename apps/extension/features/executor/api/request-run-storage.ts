import type { ActionLogEntry } from "@nemu/contracts/executor";
import { browser } from "wxt/browser";

import type { NemuMessage, PageEmail } from "../../../shared/lib/messages";
import type { NotesCard } from "../lib/recipe";
import type { RunState } from "../lib/run";

/** Content script: the executor's storage and log, through the background. */
async function send<T>(message: NemuMessage): Promise<T | null> {
  try {
    return ((await browser.runtime.sendMessage(message)) as T) ?? null;
  } catch {
    return null;
  }
}

export function requestSaveRun(state: RunState | null) {
  void send({ type: "nemu:run-save", state });
}

export function requestLoadRun(): Promise<RunState | null> {
  return send<RunState>({ type: "nemu:run-load" });
}

/**
 * The last Catatan langkah. A recipe ("Cara isi nilai kelas") has its `subtitle` ("Disimpan dari
 * pengisian Matematika 4B, 1 Des 2026.") and the task kind `offer`ed for "Coba sendiri", so both
 * come back when the Nemu button reopens it. `card` is how it showed when the task ended (a
 * read-back's "Sudah dicek"); `log` keeps the run's own lines (who did what), which the card
 * no longer shows.
 */
export type StepNotes = {
  title: string;
  items: string[];
  subtitle?: string;
  offer?: string | null;
  card?: NotesCard;
  log?: string[];
};

export function requestSaveNotes(notes: StepNotes) {
  void send({ type: "nemu:notes-save", notes });
}

export function requestLoadNotes(): Promise<StepNotes | null> {
  return send<StepNotes>({ type: "nemu:notes-load" });
}

export function requestLogActions(pageEmail: PageEmail, entries: ActionLogEntry[]) {
  void send({ type: "nemu:log-actions", pageEmail, entries });
}
