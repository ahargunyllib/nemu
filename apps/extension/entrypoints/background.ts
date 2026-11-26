import { isAllowedUrl } from "@nemu/contracts/extension";
import { browser } from "wxt/browser";

import { currentSiteConfig } from "../features/allowed-sites/api/site-config";
import { syncAddedSiteScripts } from "../features/allowed-sites/api/site-scripts";
import { identifyTeacher } from "../features/identity/api/identify-teacher";
import { askNemu } from "../features/nemu-button/api/ask-nemu";
import { isNemuMessage, type NemuMessage } from "../shared/lib/messages";

async function handle(message: NemuMessage, senderUrl: string | undefined) {
  switch (message.type) {
    case "nemu:site-access": {
      const config = await currentSiteConfig();
      return { allowed: isAllowedUrl(config?.allowedSites ?? [], senderUrl ?? message.url) };
    }
    case "nemu:identify":
      return identifyTeacher(message.pageEmail);
    case "nemu:ask":
      return askNemu(message);
  }
}

function syncScripts() {
  syncAddedSiteScripts().catch((error: unknown) => {
    console.warn("[nemu] could not register the content script on added sites", error);
  });
}

/** The only part of the extension that calls the Nemu Service for pages (ADR-0015). */
export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!isNemuMessage(message)) return;
    void handle(message, sender.url).then(sendResponse);
    return true;
  });

  // The toolbar icon opens the settings page, where the operator enters the install code.
  browser.action.onClicked.addListener(() => void browser.runtime.openOptionsPage());

  browser.permissions.onAdded.addListener(syncScripts);
  browser.permissions.onRemoved.addListener(syncScripts);
  browser.runtime.onStartup.addListener(syncScripts);
  browser.runtime.onInstalled.addListener(({ reason }) => {
    syncScripts();
    if (reason === "install") void browser.runtime.openOptionsPage();
  });
});
