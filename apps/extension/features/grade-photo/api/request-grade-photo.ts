import { browser } from "wxt/browser";

import type { NemuMessage, PageEmail } from "../../../shared/lib/messages";
import type { GradePhotoRequest, GradePhotoResponse } from "../lib/requests";

/** Content script: one F1 call through the background, which alone calls the Nemu Service. */
export async function requestGradePhoto<R extends GradePhotoRequest>(
  pageEmail: PageEmail,
  request: R,
): Promise<GradePhotoResponse<R["op"]>> {
  const message: NemuMessage = { type: "nemu:grade-photo", pageEmail, request };
  try {
    const response = (await browser.runtime.sendMessage(message)) as
      | GradePhotoResponse<R["op"]>
      | undefined;
    return response ?? { ok: false, message: "Nemu belum siap. Muat ulang halaman ini." };
  } catch {
    return { ok: false, message: "Nemu belum siap. Muat ulang halaman ini." };
  }
}
