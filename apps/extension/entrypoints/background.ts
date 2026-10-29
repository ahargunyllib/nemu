import type { Browser } from "wxt/browser";

import {
  type CaptureViewportResult,
  isCaptureViewportMessage,
  toCaptureViewportFailure,
} from "../features/area-crop/lib/capture-message";
import { createNemuClient } from "../features/chat/api/nemu-client";
import { isChatCancelMessage, isChatRequestMessage } from "../features/chat/lib/chat-message";
import { requestNemuChat } from "../features/chat/api/request-nemu-chat";
import { OPEN_COMPOSER_MESSAGE } from "../features/composer/lib/open-composer-message";
import { requestProcessInstance } from "../features/process-status/api/request-process-instance";
import { isProcessInstanceRequestMessage } from "../features/process-status/lib/process-instance-message";
import { isAllowedPage } from "../shared/lib/config";

const POPUP = "popup.html";

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

/**
 * The manifest's default popup is the one for other sites. Demo App tabs clear it, so the toolbar
 * icon there fires the action (opening the Composer and granting `activeTab`) instead. A tab's URL
 * is readable only on hosts the manifest lists, so every other page keeps the popup.
 */
function syncPopup(tab: Browser.tabs.Tab) {
  if (tab.id === undefined) return;
  const allowed = isAllowedPage(tab.url);
  void browser.action.setPopup({ tabId: tab.id, popup: allowed ? "" : POPUP });
  void browser.action.setTitle({ tabId: tab.id, title: allowed ? "Buka Composer Nemu" : "Nemu" });
}

async function syncAllPopups() {
  for (const tab of await browser.tabs.query({})) syncPopup(tab);
}

/** Screenshots the viewport of an allowlisted tab; the content script cuts the Area Crop from it. */
async function captureViewportOf(
  tab: Browser.tabs.Tab | undefined,
): Promise<CaptureViewportResult> {
  if (!tab || !isAllowedPage(tab.url)) return { ok: false };
  try {
    return {
      ok: true,
      dataUrl: await browser.tabs.captureVisibleTab(tab.windowId, { format: "png" }),
    };
  } catch (error) {
    console.warn("[nemu] capture-viewport failed", error);
    return toCaptureViewportFailure(error);
  }
}

export default defineBackground(() => {
  const client = createNemuClient();
  const pendingChats = new Map<string, AbortController>();

  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (isCaptureViewportMessage(message)) {
      void captureViewportOf(sender.tab).then(sendResponse);
      return true;
    }
    if (isChatCancelMessage(message)) {
      pendingChats.get(message.requestId)?.abort();
      pendingChats.delete(message.requestId);
      return;
    }
    if (isChatRequestMessage(message)) {
      const controller = new AbortController();
      pendingChats.set(message.requestId, controller);
      void requestNemuChat(client, message.request, sender.tab?.url, controller.signal)
        .then(sendResponse)
        .finally(() => pendingChats.delete(message.requestId));
      return true;
    }
    if (isProcessInstanceRequestMessage(message)) {
      void requestProcessInstance(client, message.instanceId, sender.tab?.url).then(sendResponse);
      return true;
    }
  });

  // Fired by the toolbar icon and by the `_execute_action` shortcut (Ctrl+Shift+Space), on Demo App
  // tabs only: everywhere else they open the popup.
  browser.action.onClicked.addListener((tab) => void openComposerIn(tab));
  browser.tabs.onUpdated.addListener((_tabId, _change, tab) => syncPopup(tab));
  // Tabs opened before the extension was installed or the browser started have no update yet.
  browser.runtime.onInstalled.addListener(() => void syncAllPopups());
  browser.runtime.onStartup.addListener(() => void syncAllPopups());
});
