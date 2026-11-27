import { browser } from "wxt/browser";

import type { NemuMessage, PageEmail } from "../../../shared/lib/messages";
import type { IdentityResult } from "../lib/identity";

/** Content script: asks the background who the page's account is. */
export async function requestIdentity(pageEmail: PageEmail): Promise<IdentityResult> {
  const message: NemuMessage = { type: "nemu:identify", pageEmail };
  try {
    return (await browser.runtime.sendMessage(message)) as IdentityResult;
  } catch {
    return { status: "error", message: "Nemu belum siap. Muat ulang halaman ini." };
  }
}
