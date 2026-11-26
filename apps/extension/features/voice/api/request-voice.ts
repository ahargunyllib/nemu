import type { SpeechSynthesis } from "@nemu/contracts/school";
import { browser } from "wxt/browser";

import type { NemuMessage, PageEmail } from "../../../shared/lib/messages";
import type { Heard } from "./speech";

/** Content script: the voice requests the background answers (the page never holds the mic). */
async function send<Result>(message: NemuMessage, fallback: Result): Promise<Result> {
  try {
    return (await browser.runtime.sendMessage(message)) as Result;
  } catch {
    return fallback;
  }
}

const NOT_READY = "Nemu belum siap. Muat ulang halaman ini.";

export function requestListenStart() {
  return send<{ ok: true } | { ok: false; message: string }>(
    { type: "nemu:listen-start" },
    { ok: false, message: NOT_READY },
  );
}

export function requestListenStop(pageEmail: PageEmail) {
  return send<Heard>({ type: "nemu:listen-stop", pageEmail }, { kind: "notice", text: NOT_READY });
}

export function requestListenCancel() {
  return send<void>({ type: "nemu:listen-cancel" }, undefined);
}

export function requestSpeech(pageEmail: PageEmail, text: string) {
  return send<SpeechSynthesis | null>({ type: "nemu:speak", pageEmail, text }, null);
}
