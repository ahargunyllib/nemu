import { browser } from "wxt/browser";

import { createRecorder } from "../../features/voice/lib/recorder";
import { isOffscreenMessage } from "../../shared/lib/messages";

/**
 * The offscreen document (`USER_MEDIA`) that holds the microphone while the teacher holds the talk
 * combination. Only the background talks to it.
 */
const recorder = createRecorder();

browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!isOffscreenMessage(message)) return;
  const run = {
    "record-start": recorder.start,
    "record-stop": recorder.stop,
    "record-cancel": recorder.cancel,
  }[message.type];
  void run().then(sendResponse);
  return true;
});
