import type { ActionLogEntry } from "@nemu/contracts/executor";
import { browser } from "wxt/browser";

import type { NemuMessage, PageEmail } from "../../../shared/lib/messages";
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

export type StepNotes = { title: string; items: string[] };

export function requestSaveNotes(notes: StepNotes) {
  void send({ type: "nemu:notes-save", notes });
}

export function requestLoadNotes(): Promise<StepNotes | null> {
  return send<StepNotes>({ type: "nemu:notes-load" });
}

export function requestLogActions(pageEmail: PageEmail, entries: ActionLogEntry[]) {
  void send({ type: "nemu:log-actions", pageEmail, entries });
}
