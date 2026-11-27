import { browser } from "wxt/browser";

import { currentSiteConfig } from "../features/allowed-sites/api/site-config";
import { syncAddedSiteScripts } from "../features/allowed-sites/api/site-scripts";
import { siteAccessFor } from "../features/allowed-sites/lib/site-access";
import { recordActions } from "../features/executor/api/record-actions";
import {
  forgetClosedTabs,
  loadNotes,
  loadRun,
  saveNotes,
  saveRun,
} from "../features/executor/api/run-storage";
import { identifyTeacher } from "../features/identity/api/identify-teacher";
import { askNemu } from "../features/nemu-button/api/ask-nemu";
import { cancelRecording, startRecording } from "../features/voice/api/microphone";
import { synthesizeSentence, transcribeRecording } from "../features/voice/api/speech";
import { isNemuMessage, type NemuMessage } from "../shared/lib/messages";

async function handle(
  message: NemuMessage,
  senderUrl: string | undefined,
  tab: { id?: number; windowId?: number } | undefined,
) {
  const tabId = tab?.id;
  switch (message.type) {
    case "nemu:site-access": {
      const config = await currentSiteConfig();
      return { access: siteAccessFor(config, senderUrl ?? message.url) };
    }
    case "nemu:identify":
      return identifyTeacher(message.pageEmail);
    case "nemu:ask":
      return askNemu(message, tab);
    case "nemu:listen-start":
      return startRecording();
    case "nemu:listen-stop":
      return transcribeRecording(message.pageEmail);
    case "nemu:listen-cancel":
      return cancelRecording();
    case "nemu:speak":
      return synthesizeSentence(message.pageEmail, message.text);
    case "nemu:run-save":
      return saveRun(tabId, message.state);
    case "nemu:run-load":
      return loadRun(tabId);
    case "nemu:notes-save":
      return saveNotes(message.notes);
    case "nemu:notes-load":
      return loadNotes();
    case "nemu:log-actions":
      return recordActions(message);
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
    void handle(message, sender.url, sender.tab).then(sendResponse);
    return true;
  });

  // The toolbar icon opens the settings page, where the operator enters the install code.
  browser.action.onClicked.addListener(() => void browser.runtime.openOptionsPage());

  forgetClosedTabs();
  browser.permissions.onAdded.addListener(syncScripts);
  browser.permissions.onRemoved.addListener(syncScripts);
  browser.runtime.onStartup.addListener(syncScripts);
  browser.runtime.onInstalled.addListener(({ reason }) => {
    syncScripts();
    // The welcome page asks for the microphone once and leads on to the settings page.
    if (reason === "install")
      void browser.tabs.create({ url: browser.runtime.getURL("/welcome.html") });
  });
});
