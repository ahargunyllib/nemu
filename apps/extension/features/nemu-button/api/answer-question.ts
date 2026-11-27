import type { PageSnapshot } from "@nemu/contracts/school";

import type { NemuServiceClient } from "../../../shared/api/nemu-service";
import { fromExplanation, PASSWORD_ON_SCREEN } from "../../ini-kenapa/lib/explanation";
import { type AskResult, fromGroundedAnswer, NOT_AVAILABLE_YET } from "../lib/answer";

/**
 * A typed or spoken question goes to `helpRoute` first (docs/school-ai.md). Questions about the
 * school's rules go to `helpAsk`, "kenapa" to `helpExplain` with what the page shows plus a
 * viewport screenshot, and a voice control closes the bubble. `snapshot` is null while a password
 * field is on screen: then "kenapa" reads and sends nothing (F2-07). Grade entry goes to F1
 * (#207); a process the school uploaded as BPMN to F3 (#213).
 */
export async function answerQuestion(
  client: Pick<NemuServiceClient, "helpRoute" | "helpAsk" | "helpExplain">,
  question: string,
  snapshot: PageSnapshot | null,
  captureScreenshot: () => Promise<string | null> = async () => null,
): Promise<AskResult> {
  const route = await client.helpRoute({ utterance: question });
  if (route.kind === "control") return { kind: "stop" };
  switch (route.intent) {
    case "kenapa": {
      if (!snapshot) return { kind: "notice", text: PASSWORD_ON_SCREEN };
      const screenshotBase64 = await captureScreenshot();
      return fromExplanation(
        await client.helpExplain({ snapshot: { ...snapshot, screenshotBase64 }, question }),
      );
    }
    case "tanya":
    case "unknown":
      return fromGroundedAnswer(await client.helpAsk({ question }));
    case "input_nilai":
      // F1 (#207) takes it from here: the class, subject and assessment, then the photo.
      return { kind: "grades", utterance: question };
    case "proses":
      return route.processName
        ? { kind: "process", utterance: question, processName: route.processName }
        : { kind: "notice", text: NOT_AVAILABLE_YET };
  }
}
