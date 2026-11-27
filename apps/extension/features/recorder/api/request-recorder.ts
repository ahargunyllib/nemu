import { browser } from "wxt/browser";

import type { NemuMessage, PageEmail } from "../../../shared/lib/messages";
import type { RecorderRequest, RecorderResponse } from "../lib/requests";

/** Content script: one "Rekam cara" call through the background. */
export async function requestRecorder<R extends RecorderRequest>(
  pageEmail: PageEmail,
  request: R,
): Promise<RecorderResponse<R["op"]>> {
  const message: NemuMessage = { type: "nemu:recorder", pageEmail, request };
  try {
    const response = (await browser.runtime.sendMessage(message)) as
      | RecorderResponse<R["op"]>
      | undefined;
    return response ?? { ok: false, message: "Nemu belum siap. Muat ulang halaman ini." };
  } catch {
    return { ok: false, message: "Nemu belum siap. Muat ulang halaman ini." };
  }
}
