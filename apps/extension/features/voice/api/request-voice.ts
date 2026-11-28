import type { SpeechSynthesis } from "@nemu/contracts/school";
import { browser } from "wxt/browser";

import type { NemuMessage, PageEmail, Recording } from "../../../shared/lib/messages";
import type { Heard } from "./speech";

/** Content script: the voice requests the background answers, which alone calls the Nemu Service. */
async function send<Result>(message: NemuMessage, fallback: Result): Promise<Result> {
  try {
    return (await browser.runtime.sendMessage(message)) as Result;
  } catch {
    return fallback;
  }
}

const NOT_READY = "Nemu belum siap. Muat ulang halaman ini.";

export function requestTranscription(pageEmail: PageEmail, recording: Recording) {
  return send<Heard>(
    { type: "nemu:transcribe", pageEmail, recording },
    { kind: "notice", text: NOT_READY },
  );
}

export function requestSpeech(pageEmail: PageEmail, text: string) {
  return send<SpeechSynthesis | null>({ type: "nemu:speak", pageEmail, text }, null);
}
