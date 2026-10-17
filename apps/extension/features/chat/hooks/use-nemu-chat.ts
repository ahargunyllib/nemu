import type { PageElement } from "@nemu/contracts";
import { useCallback, useRef, useState } from "react";

import { sendChatRequest } from "../api/chat-messaging";
import type { ChatResult } from "../lib/chat-message";

export type ChatState =
  | { kind: "idle" }
  | ({ prompt: string } & ({ kind: "loading" } | ChatResult));

export function useNemuChat() {
  const [sessionId] = useState(() => crypto.randomUUID());
  const [state, setState] = useState<ChatState>({ kind: "idle" });
  const latestRequest = useRef(0);

  const send = useCallback(
    async (prompt: string, elements: PageElement[]) => {
      const requestId = ++latestRequest.current;
      setState({ kind: "loading", prompt });
      const result = await sendChatRequest({
        session_id: sessionId,
        url: window.location.href,
        prompt,
        elements,
      });
      if (requestId === latestRequest.current) setState({ ...result, prompt });
    },
    [sessionId],
  );

  const reset = useCallback(() => {
    latestRequest.current++;
    setState({ kind: "idle" });
  }, []);

  return { state, send, reset };
}
