import { quizCommand } from "@nemu/ai/school/commands";
import type { PageSnapshot } from "@nemu/contracts/school";

import type { NemuServiceClient } from "../../../shared/api/nemu-service";
import { fromExplanation, PASSWORD_ON_SCREEN } from "../../ini-kenapa/lib/explanation";
import {
  type AskResult,
  fromGroundedAnswer,
  NOT_AVAILABLE_YET,
  recordCommand,
} from "../lib/answer";

const BARE_KENAPA = new Set([
  "nemu",
  "ini",
  "itu",
  "kenapa",
  "mengapa",
  "kok",
  "apa",
  "ya",
  "bu",
  "pak",
]);

/** Whether a "kenapa" question says what it is about, beyond "Nemu, ini kenapa ya?". */
function saysMore(question: string): boolean {
  return question
    .toLocaleLowerCase("id-ID")
    .split(/[^\p{L}\p{N}]+/u)
    .some((word) => word.length > 1 && !BARE_KENAPA.has(word));
}

/**
 * A typed or spoken question goes to `helpRoute` first (docs/school-ai.md). Questions about the
 * school's rules go to `helpAsk`, "kenapa" to `helpExplain` with what the page shows plus a
 * viewport screenshot (then `helpAsk` when the kamus and the BPMN have nothing, #314), and a voice
 * control closes the bubble. `snapshot` is null while a password field is on screen: then "kenapa"
 * reads and sends nothing (F2-07). Grade entry goes to F1 (#207); a process the school uploaded as
 * BPMN to F3 (#213); checking a Moodle quiz to F4 (#209), deleting one to F4-06 (#211), and putting
 * the teacher's script into Moodle as a quiz to F4-03 (#210).
 */
export async function answerQuestion(
  client: Pick<NemuServiceClient, "helpRoute" | "helpAsk" | "helpExplain">,
  question: string,
  snapshot: PageSnapshot | null,
  captureScreenshot: () => Promise<string | null> = async () => null,
): Promise<AskResult> {
  // "Rekam cara …" is the extension's own command; nothing is sent for it.
  const recordTitle = recordCommand(question);
  if (recordTitle !== null) return { kind: "record", title: recordTitle };
  // Deleting a quiz: Nemu counts who took it and warns; she presses Hapus (F4-06, #211). "Masukkan
  // kuis dari naskah ini" is put into Moodle by the extension (F4-03, #210). "Nemu, tolong cek kuis
  // ini" is checked in the page itself (F4-01, #209).
  const quiz = quizCommand(question);
  if (quiz) return { kind: quiz, utterance: question };
  const route = await client.helpRoute({ utterance: question });
  if (route.kind === "control") return { kind: "stop" };
  switch (route.intent) {
    case "kenapa": {
      if (!snapshot) return { kind: "notice", text: PASSWORD_ON_SCREEN };
      const screenshotBase64 = await captureScreenshot();
      const explanation = await client.helpExplain({
        snapshot: { ...snapshot, screenshotBase64 },
        question,
      });
      // "Kenapa Nemu tidak bisa mendengar saya?" isn't a page error: the school's documents may
      // answer what the kamus and the BPMN don't (#314). A bare "ini kenapa?" or an error on the
      // page is the kamus's alone, so the offer to ask stays.
      if (explanation.status === "not_in_guide" && !snapshot.alerts.length && saysMore(question)) {
        const answer = await client.helpAsk({ question });
        if (answer.status === "answered") return fromGroundedAnswer(answer);
      }
      return fromExplanation(explanation);
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
