import type { PageSnapshot } from "@nemu/contracts/school";
import { useCallback, useRef, useState } from "react";

import type { PageEmail } from "../../../shared/lib/messages";
import { requestAnswer } from "../api/request-answer";
import type { AskResult } from "../lib/answer";
import { readPageSnapshot } from "../../ini-kenapa/lib/page-snapshot";

export type AskState =
  | { status: "idle" }
  | { status: "asking"; question: string }
  | {
      status: "answered";
      question: string;
      result: Exclude<
        AskResult,
        { kind: "stop" } | { kind: "grades" } | { kind: "process" } | { kind: "record" }
      >;
    };

/**
 * One question at a time; a newer question or `reset` drops the older answer. The page is read
 * when the question is asked, unless the caller read it earlier (at the talk key-down). A grade
 * request goes to `onGrades` (F1) and a process run to `onProcess` (F3) instead of an answer.
 */
export function useAsk(
  pageEmail: PageEmail,
  onStop: () => void,
  onGrades: (utterance: string) => void = () => undefined,
  onProcess: (utterance: string, processName: string) => void = () => undefined,
  onRecord: (title: string) => void = () => undefined,
) {
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
      if (result.kind === "grades") {
        setState({ status: "idle" });
        onGrades(result.utterance);
        return;
      }
      if (result.kind === "process") {
        setState({ status: "idle" });
        onProcess(result.utterance, result.processName);
        return;
      }
      if (result.kind === "record") {
        setState({ status: "idle" });
        onRecord(result.title);
        return;
      }
      setState({ status: "answered", question, result });
    },
    [pageEmail, onStop, onGrades, onProcess, onRecord],
  );

  const reset = useCallback(() => {
    latest.current += 1;
    setState({ status: "idle" });
  }, []);

  return { state, ask, reset };
}
