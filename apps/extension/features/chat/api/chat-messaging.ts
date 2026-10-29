import { browser } from "wxt/browser";

import {
  CHAT_ERRORS,
  type ChatCancelMessage,
  type ChatRequestMessage,
  type ChatResult,
  isChatResult,
} from "../lib/chat-message";

/** Content-script side: hands the request to the background, which holds the server access. */
export function sendChatRequest(
  request: ChatRequestMessage["request"],
  signal?: AbortSignal,
): Promise<ChatResult | undefined> {
  const requestId = crypto.randomUUID();
  const message: ChatRequestMessage = { type: "nemu:chat", requestId, request };

  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: ChatResult | undefined) => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener("abort", abort);
      resolve(result);
    };
    const abort = () => {
      const cancellation: ChatCancelMessage = { type: "nemu:chat:cancel", requestId };
      void browser.runtime.sendMessage(cancellation).catch(() => undefined);
      finish(undefined);
    };

    if (signal?.aborted) {
      finish(undefined);
      return;
    }
    signal?.addEventListener("abort", abort, { once: true });

    void browser.runtime.sendMessage(message).then(
      (result: unknown) =>
        finish(isChatResult(result) ? result : { kind: "error", message: CHAT_ERRORS.unreachable }),
      () => finish({ kind: "error", message: CHAT_ERRORS.unreachable }),
    );
  });
}
