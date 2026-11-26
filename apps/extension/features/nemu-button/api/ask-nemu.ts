import type { ScreenSnapshot } from "@nemu/contracts/school";

import { failureMessage } from "../../../shared/api/nemu-service";
import type { PageEmail } from "../../../shared/lib/messages";
import { teacherClient } from "../../identity/api/teacher-client";
import type { AskResult } from "../lib/answer";
import { answerQuestion } from "./answer-question";

/** Background: answers a typed or spoken question as the teacher whose email the page shows. */
export async function askNemu(request: {
  pageEmail: PageEmail;
  question: string;
  snapshot: ScreenSnapshot;
}): Promise<AskResult> {
  const teacher = await teacherClient(request.pageEmail);
  if ("notice" in teacher) return { kind: "notice", text: teacher.notice };
  try {
    return await answerQuestion(teacher.client, request.question, request.snapshot);
  } catch (error) {
    return { kind: "notice", text: failureMessage(error) };
  }
}
