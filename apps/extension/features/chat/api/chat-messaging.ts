import { browser } from "wxt/browser";

import {
  CHAT_ERRORS,
  type ChatRequestMessage,
  type ChatResult,
  isChatResult,
} from "../lib/chat-message";

/** Content-script side: hands the request to the background, which holds the server access. */
export async function sendChatRequest(request: ChatRequestMessage["request"]): Promise<ChatResult> {
  const message: ChatRequestMessage = { type: "nemu:chat", request };
  try {
    const result: unknown = await browser.runtime.sendMessage(message);
    return isChatResult(result) ? result : { kind: "error", message: CHAT_ERRORS.unreachable };
  } catch {
    return { kind: "error", message: CHAT_ERRORS.unreachable };
  }
}
