import { browser } from "wxt/browser";

import type { NemuMessage, PageEmail } from "../../../shared/lib/messages";
import type { ProcessRunRequest, ProcessRunResponse } from "../lib/requests";

/** Content script: one F3 call through the background, which alone calls the Nemu Service. */
export async function requestProcessRun<R extends ProcessRunRequest>(
  pageEmail: PageEmail,
  request: R,
): Promise<ProcessRunResponse<R["op"]>> {
  const message: NemuMessage = { type: "nemu:process-run", pageEmail, request };
  try {
    const response = (await browser.runtime.sendMessage(message)) as
      | ProcessRunResponse<R["op"]>
      | undefined;
    return response ?? { ok: false, message: "Nemu belum siap. Muat ulang halaman ini." };
  } catch {
    return { ok: false, message: "Nemu belum siap. Muat ulang halaman ini." };
  }
}
