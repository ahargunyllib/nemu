import type { PageElement } from "@nemu/contracts";
import { useCallback, useRef, useState } from "react";

import { collectSettledElementList } from "../../element-list/lib/settled-element-list";
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

type Question = { prompt: string; followedUp: boolean };

export function useNemuChat() {
  const [sessionId] = useState(() => crypto.randomUUID());
  const [state, setState] = useState<ChatState>({ kind: "idle" });
  const latestRequest = useRef(0);
  const question = useRef<Question | null>(null);

  const request = useCallback(
    async (prompt: string, elements: PageElement[], screenshotCrop?: string): Promise<void> => {
      const requestId = ++latestRequest.current;
      const url = window.location.href;
      setState({ kind: "loading", prompt, elements, screenshotCrop });
      const result = await sendChatRequest({
        session_id: sessionId,
        url,
        prompt,
        elements,
        ...(screenshotCrop && { screenshot_crop: screenshotCrop }),
      });
      if (requestId !== latestRequest.current) return;

      if (window.location.href !== url) {
        // Rina went to another page while Nemu was reading, so the answer points at targets that
        // are gone. Ask again with the page she is on now; the Area Crop shows the old one.
        const current = await collectSettledElementList(new AbortController().signal);
        if (requestId === latestRequest.current) await request(prompt, current);
        return;
      }
      setState({ ...result, prompt, elements, screenshotCrop });
    },
    [sessionId],
  );

  const send = useCallback(
    (prompt: string, elements: PageElement[], screenshotCrop?: string) => {
      question.current = { prompt, followedUp: false };
      return request(prompt, elements, screenshotCrop);
    },
    [request],
  );

  /**
   * Asks the current question again from the page a click opened, at most once per question.
   * The Area Crop shows the page before the click, so it stays behind.
   */
  const followUp = useCallback(
    (elements: PageElement[]) => {
      const current = question.current;
      if (!current || current.followedUp) return;
      current.followedUp = true;
      return request(current.prompt, elements);
    },
    [request],
  );

  const reset = useCallback(() => {
    latestRequest.current++;
    question.current = null;
    setState({ kind: "idle" });
  }, []);

  return { state, send, followUp, reset };
}
