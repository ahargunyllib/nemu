import type { PageSnapshot } from "@nemu/contracts/school";
import { useCallback, useRef, useState } from "react";

import type { PageEmail } from "../../../shared/lib/messages";
import { requestAnswer } from "../api/request-answer";
import type { AskResult } from "../lib/answer";
import { readPageSnapshot } from "../../ini-kenapa/lib/page-snapshot";

export type AskState =
  | { status: "idle" }
  | { status: "asking"; question: string }
  | { status: "answered"; question: string; result: Exclude<AskResult, { kind: "stop" }> };

/**
 * One question at a time; a newer question or `reset` drops the older answer. The page is read
 * when the question is asked, unless the caller read it earlier (at the talk key-down).
 */
export function useAsk(pageEmail: PageEmail, onStop: () => void) {
  const [state, setState] = useState<AskState>({ status: "idle" });
  const latest = useRef(0);

  const ask = useCallback(
    async (
      question: string,
      snapshot: PageSnapshot | null = readPageSnapshot(document, location.href),
    ) => {
      const id = ++latest.current;
      setState({ status: "asking", question });
      const result = await requestAnswer(pageEmail, question, snapshot);
      if (id !== latest.current) return;
      if (result.kind === "stop") {
        setState({ status: "idle" });
        onStop();
        return;
      }
      setState({ status: "answered", question, result });
    },
    [pageEmail, onStop],
  );

  const reset = useCallback(() => {
    latest.current += 1;
    setState({ status: "idle" });
  }, []);

  return { state, ask, reset };
}
