import type { QuizScriptInput, QuizScriptResult } from "@nemu/contracts/quiz";

/** What F4-03 in the page asks the background for (#210). */
export type QuizImportRequest =
  /** The teacher's script read by the Nemu Service as the page's teacher (#219). */
  { op: "read"; input: QuizScriptInput };

export type QuizImportValue = { read: QuizScriptResult };

export type QuizImportResponse<Op extends QuizImportRequest["op"]> =
  | { ok: true; value: QuizImportValue[Op] }
  | { ok: false; message: string };
