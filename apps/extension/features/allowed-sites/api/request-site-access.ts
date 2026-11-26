import { browser } from "wxt/browser";

import type { NemuMessage } from "../../../shared/lib/messages";

/** Asks the background whether this page is on the school's WS-03 list. */
export async function requestSiteAccess(url: string): Promise<boolean> {
  const message: NemuMessage = { type: "nemu:site-access", url };
  try {
    const response: unknown = await browser.runtime.sendMessage(message);
    return typeof response === "object" && response !== null && "allowed" in response
      ? response.allowed === true
      : false;
  } catch {
    return false;
  }
}
