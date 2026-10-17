import { createNemuClient } from "../features/chat/api/nemu-client";
import { isChatRequestMessage } from "../features/chat/lib/chat-message";
import { requestNemuChat } from "../features/chat/api/request-nemu-chat";

export default defineBackground(() => {
  const client = createNemuClient();

  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!isChatRequestMessage(message)) return;
    void requestNemuChat(client, message.request, sender.tab?.url).then(sendResponse);
    return true;
  });
});
