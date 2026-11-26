import type { ScreenSnapshot } from "@nemu/contracts/school";
import { browser } from "wxt/browser";

import type { NemuMessage, PageEmail } from "../../../shared/lib/messages";
import type { AskResult } from "../lib/answer";

/** Content script: sends the typed question to the background, which calls the Nemu Service. */
export async function requestAnswer(
  pageEmail: PageEmail,
  question: string,
  snapshot: ScreenSnapshot,
): Promise<AskResult> {
  const message: NemuMessage = { type: "nemu:ask", pageEmail, question, snapshot };
  try {
    return (await browser.runtime.sendMessage(message)) as AskResult;
  } catch {
    return { kind: "notice", text: "Nemu belum siap. Muat ulang halaman ini." };
  }
}
