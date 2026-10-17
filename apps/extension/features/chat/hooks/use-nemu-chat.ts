import type { PageElement } from "@nemu/contracts";
import { useCallback, useRef, useState } from "react";

import { sendChatRequest } from "../api/chat-messaging";
import type { ChatResult } from "../lib/chat-message";

/**
 * A sent prompt keeps the Element List it carried (only those targets can be clicked) and its
 * Area Crop, so a retry sends the same question.
 */
export type ChatState =
  | { kind: "idle" }
  | ({ prompt: string; elements: PageElement[]; screenshotCrop?: string } & (
      | { kind: "loading" }
      | ChatResult
    ));

export function useNemuChat() {
  const [sessionId] = useState(() => crypto.randomUUID());
  const [state, setState] = useState<ChatState>({ kind: "idle" });
  const latestRequest = useRef(0);

  const send = useCallback(
    async (prompt: string, elements: PageElement[], screenshotCrop?: string) => {
      const requestId = ++latestRequest.current;
      setState({ kind: "loading", prompt, elements, screenshotCrop });
      const result = await sendChatRequest({
        session_id: sessionId,
        url: window.location.href,
        prompt,
        elements,
        ...(screenshotCrop && { screenshot_crop: screenshotCrop }),
      });
      if (requestId === latestRequest.current) {
        setState({ ...result, prompt, elements, screenshotCrop });
      }
    },
    [sessionId],
  );

  const reset = useCallback(() => {
    latestRequest.current++;
    setState({ kind: "idle" });
  }, []);

  return { state, send, reset };
}
