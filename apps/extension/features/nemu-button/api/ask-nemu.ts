import type { ScreenSnapshot } from "@nemu/contracts/school";

import { createNemuServiceClient, failureMessage } from "../../../shared/api/nemu-service";
import { installCodeItem } from "../../../shared/lib/extension-storage";
import type { PageEmail } from "../../../shared/lib/messages";
import { resolveEmail } from "../../identity/api/identify-teacher";
import { NOT_INSTALLED_MESSAGE, SIGNED_OUT_MESSAGE } from "../../identity/lib/identity";
import type { AskResult } from "../lib/answer";
import { answerQuestion } from "./answer-question";

/** Background: answers a typed question as the teacher whose email the page shows (ADR-0015). */
export async function askNemu(request: {
  pageEmail: PageEmail;
  question: string;
  snapshot: ScreenSnapshot;
}): Promise<AskResult> {
  const [installCode, email] = await Promise.all([
    installCodeItem.getValue(),
    resolveEmail(request.pageEmail),
  ]);
  if (!installCode) return { kind: "notice", text: NOT_INSTALLED_MESSAGE };
  if (!email) return { kind: "notice", text: SIGNED_OUT_MESSAGE };
  try {
    return await answerQuestion(
      createNemuServiceClient({ installCode, email }),
      request.question,
      request.snapshot,
    );
  } catch (error) {
    return { kind: "notice", text: failureMessage(error) };
  }
}
