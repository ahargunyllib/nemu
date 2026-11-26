import type { ScreenSnapshot } from "@nemu/contracts/school";

import type { NemuServiceClient } from "../../../shared/api/nemu-service";
import {
  type AskResult,
  fromExplanation,
  fromGroundedAnswer,
  NOT_FROM_TYPING_YET,
} from "../lib/answer";

/**
 * A typed question goes to `helpRoute` first (docs/school-ai.md). Questions about the school's
 * rules go to `helpAsk`, "kenapa" to `helpExplain` with what the page shows, and a voice control
 * closes the bubble. Grade entry and processes wait for #200 and #202.
 */
export async function answerQuestion(
  client: Pick<NemuServiceClient, "helpRoute" | "helpAsk" | "helpExplain">,
  question: string,
  snapshot: ScreenSnapshot,
): Promise<AskResult> {
  const route = await client.helpRoute({ utterance: question });
  if (route.kind === "control") return { kind: "stop" };
  switch (route.intent) {
    case "kenapa":
      return fromExplanation(await client.helpExplain({ snapshot, question }));
    case "tanya":
    case "unknown":
      return fromGroundedAnswer(await client.helpAsk({ question }));
    case "input_nilai":
    case "proses":
      return { kind: "notice", text: NOT_FROM_TYPING_YET };
  }
}
