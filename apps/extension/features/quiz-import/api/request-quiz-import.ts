import { browser } from "wxt/browser";

import type { NemuMessage, PageEmail } from "../../../shared/lib/messages";
import type { QuizImportRequest, QuizImportResponse } from "../lib/requests";

/** Content script: one F4-03 call through the background, which alone calls the Nemu Service. */
export async function requestQuizImport<R extends QuizImportRequest>(
  pageEmail: PageEmail,
  request: R,
): Promise<QuizImportResponse<R["op"]>> {
  const message: NemuMessage = { type: "nemu:quiz-import", pageEmail, request };
  try {
    const response = (await browser.runtime.sendMessage(message)) as
      | QuizImportResponse<R["op"]>
      | undefined;
    return response ?? { ok: false, message: "Nemu belum siap. Muat ulang halaman ini." };
  } catch {
    return { ok: false, message: "Nemu belum siap. Muat ulang halaman ini." };
  }
}
