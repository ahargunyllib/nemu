import { browser } from "wxt/browser";

import type { NemuMessage } from "../../../shared/lib/messages";
import { parseSiteAccess, type SiteAccess } from "../lib/site-access";

/**
 * Asks the background whether this page is on the school's WS-03 list, and if so what Nemu may do
 * there and how the school set it up (WS-08). Null off the list or when the background can't say.
 */
export async function requestSiteAccess(url: string): Promise<SiteAccess | null> {
  const message: NemuMessage = { type: "nemu:site-access", url };
  try {
    return parseSiteAccess(await browser.runtime.sendMessage(message));
  } catch {
    return null;
  }
}
