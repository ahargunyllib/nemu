import type { Browser } from "wxt/browser";

import { createNemuClient } from "../features/chat/api/nemu-client";
import { isChatRequestMessage } from "../features/chat/lib/chat-message";
import { requestNemuChat } from "../features/chat/api/request-nemu-chat";
import { OPEN_COMPOSER_MESSAGE } from "../features/composer/lib/open-composer-message";

/**
 * Asks the tab's content script to open the Composer; tabs outside the allowlist have none.
 * Arc fires the action without a tab, so fall back to the active tab.
 */
async function openComposerIn(tab: Browser.tabs.Tab | undefined) {
  const tabId =
    tab?.id ?? (await browser.tabs.query({ active: true, lastFocusedWindow: true }))[0]?.id;
  if (tabId === undefined) {
    console.warn("[nemu] open-composer: no active tab");
    return;
  }
  await browser.tabs.sendMessage(tabId, OPEN_COMPOSER_MESSAGE).catch((error: unknown) => {
    console.warn("[nemu] open-composer: no Nemu overlay on tab", tabId, error);
  });
}

export default defineBackground(() => {
  const client = createNemuClient();

  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!isChatRequestMessage(message)) return;
    void requestNemuChat(client, message.request, sender.tab?.url).then(sendResponse);
    return true;
  });

  // Fired by the toolbar icon and by the `_execute_action` shortcut (Ctrl+Shift+Space).
  browser.action.onClicked.addListener((tab) => void openComposerIn(tab));
});
