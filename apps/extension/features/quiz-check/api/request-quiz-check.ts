import { browser } from "wxt/browser";

import type { NemuMessage, PageEmail } from "../../../shared/lib/messages";
import type { QuizCheckRequest, QuizCheckResponse } from "../lib/requests";

/** Content script: one F4-01 call through the background, which alone calls the Nemu Service. */
export async function requestQuizCheck<R extends QuizCheckRequest>(
  pageEmail: PageEmail,
  request: R,
): Promise<QuizCheckResponse<R["op"]>> {
  const message: NemuMessage = { type: "nemu:quiz-check", pageEmail, request };
  try {
    const response = (await browser.runtime.sendMessage(message)) as
      | QuizCheckResponse<R["op"]>
      | undefined;
    return response ?? { ok: false, message: "Nemu belum siap. Muat ulang halaman ini." };
  } catch {
    return { ok: false, message: "Nemu belum siap. Muat ulang halaman ini." };
  }
}
