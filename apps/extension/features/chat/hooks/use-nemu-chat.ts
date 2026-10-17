import type { PageElement } from "@nemu/contracts";
import { useCallback, useRef, useState } from "react";

import { sendChatRequest } from "../api/chat-messaging";
import type { ChatResult } from "../lib/chat-message";

/** A sent prompt keeps the Element List it carried: only those targets can be clicked. */
export type ChatState =
  | { kind: "idle" }
  | ({ prompt: string; elements: PageElement[] } & ({ kind: "loading" } | ChatResult));

export function useNemuChat() {
  const [sessionId] = useState(() => crypto.randomUUID());
  const [state, setState] = useState<ChatState>({ kind: "idle" });
  const latestRequest = useRef(0);

  const send = useCallback(
    async (prompt: string, elements: PageElement[]) => {
      const requestId = ++latestRequest.current;
      setState({ kind: "loading", prompt, elements });
      const result = await sendChatRequest({
        session_id: sessionId,
        url: window.location.href,
        prompt,
        elements,
      });
      if (requestId === latestRequest.current) setState({ ...result, prompt, elements });
    },
    [sessionId],
  );

  const reset = useCallback(() => {
    latestRequest.current++;
    setState({ kind: "idle" });
  }, []);

  return { state, send, reset };
}
