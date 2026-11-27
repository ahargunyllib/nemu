import type { QuizJudgeInput, QuizJudgement } from "@nemu/contracts/quiz";

/** What F4-01 in the page asks the background for (#209). */
export type QuizCheckRequest =
  /** Checks that need judgement (#218), from the Nemu Service as the page's teacher. */
  | { op: "judge"; input: QuizJudgeInput }
  /** The problems being pointed at in this tab, kept across page loads (F0-13). */
  | { op: "state-save"; state: unknown }
  | { op: "state-load" };

export type QuizCheckValue = {
  judge: QuizJudgement;
  "state-save": null;
  "state-load": unknown;
};

export type QuizCheckResponse<Op extends QuizCheckRequest["op"]> =
  | { ok: true; value: QuizCheckValue[Op] }
  | { ok: false; message: string };
