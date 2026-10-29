import type { PageElement } from "@nemu/contracts";
import { useCallback, useEffect, useRef, useState } from "react";

import { collectSettledElementList } from "../../element-list/lib/settled-element-list";
import { useGuideSession } from "../../guide/hooks/use-guide-session";
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

type Question = { prompt: string; fallbackFollowedUp: boolean };

export function useNemuChat() {
  const [sessionId] = useState(() => crypto.randomUUID());
  const [state, setState] = useState<ChatState>({ kind: "idle" });
  const latestRequest = useRef(0);
  const pendingRequest = useRef<AbortController | null>(null);
  const question = useRef<Question | null>(null);
  const guide = useGuideSession();

  const request = useCallback(
    async (prompt: string, elements: PageElement[], screenshotCrop?: string): Promise<void> => {
      const requestId = ++latestRequest.current;
      pendingRequest.current?.abort();
      const controller = new AbortController();
      pendingRequest.current = controller;
      const url = window.location.href;
      setState({ kind: "loading", prompt, elements, screenshotCrop });
      const result = await sendChatRequest(
        {
          session_id: sessionId,
          url,
          prompt,
          elements,
          ...(screenshotCrop && { screenshot_crop: screenshotCrop }),
        },
        controller.signal,
      );
      if (pendingRequest.current === controller) pendingRequest.current = null;
      if (!result || requestId !== latestRequest.current) return;

      if (window.location.href !== url) {
        // Rina went to another page while Nemu was reading, so the answer points at targets that
        // are gone. Ask again with the page she is on now; the Area Crop shows the old one.
        const current = await collectSettledElementList(controller.signal);
        if (requestId === latestRequest.current) await request(prompt, current);
        return;
      }
      guide.synchronize(prompt, result.kind === "response" ? result.response.guide : undefined);
      setState({ ...result, prompt, elements, screenshotCrop });
    },
    [guide.synchronize, sessionId],
  );

  const send = useCallback(
    (prompt: string, elements: PageElement[], screenshotCrop?: string) => {
      guide.clear();
      question.current = { prompt, fallbackFollowedUp: false };
      return request(prompt, elements, screenshotCrop);
    },
    [guide.clear, request],
  );

  /**
   * Asks the current question again from the page a click opened, once per guide/page/step.
   * Responses without a guide keep the legacy one-follow-up limit.
   * The Area Crop shows the page before the click, so it stays behind.
   */
  const followUp = useCallback(
    (elements: PageElement[]) => {
      const current = question.current;
      if (!current) return;
      if (guide.session) {
        if (!guide.reserveFollowUp(window.location.href)) return;
      } else {
        if (current.fallbackFollowedUp) return;
        current.fallbackFollowedUp = true;
      }
      return request(current.prompt, elements);
    },
    [guide.reserveFollowUp, guide.session, request],
  );

  const cancel = useCallback(() => {
    latestRequest.current++;
    pendingRequest.current?.abort();
    pendingRequest.current = null;
    question.current = null;
    guide.clear();
    setState({ kind: "idle" });
  }, [guide.clear]);

  useEffect(() => {
    if (state.kind !== "loading") return;
    const cancelOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") cancel();
    };
    window.addEventListener("keydown", cancelOnEscape, { capture: true });
    return () => window.removeEventListener("keydown", cancelOnEscape, { capture: true });
  }, [cancel, state.kind]);

  return { state, guideSession: guide.session, send, followUp, cancel, reset: cancel };
}
