import type { SpeechSynthesis } from "@nemu/contracts/school";

import { failureMessage } from "../../../shared/api/nemu-service";
import type { PageEmail, Recording } from "../../../shared/lib/messages";
import { teacherClient } from "../../identity/api/teacher-client";

/** What the teacher said, or the sentence to show instead (nothing heard, no install code…). */
export type Heard = { kind: "heard"; text: string } | { kind: "notice"; text: string };

export const NOTHING_HEARD =
  "Nemu tidak mendengar suara. Tahan tombolnya sambil bicara, lalu lepaskan.";

/** Background: sends the page's recording to `speechTranscribe` (F0-04). */
export async function transcribeRecording(
  pageEmail: PageEmail,
  recording: Recording,
): Promise<Heard> {
  if (!recording) return { kind: "notice", text: NOTHING_HEARD };
  const teacher = await teacherClient(pageEmail);
  if ("notice" in teacher) return { kind: "notice", text: teacher.notice };
  try {
    const { text } = await teacher.client.speechTranscribe(recording);
    return text.trim()
      ? { kind: "heard", text: text.trim() }
      : { kind: "notice", text: NOTHING_HEARD };
  } catch (error) {
    return { kind: "notice", text: failureMessage(error) };
  }
}

/**
 * Background: Nemu's sentence as audio with word timings (F0-05), or null when the Nemu Service
 * can't be reached and the page should speak it with the local voice.
 */
export async function synthesizeSentence(
  pageEmail: PageEmail,
  text: string,
): Promise<SpeechSynthesis | null> {
  const teacher = await teacherClient(pageEmail);
  if ("notice" in teacher) return null;
  try {
    return await teacher.client.speechSynthesize({ text });
  } catch (error) {
    console.warn("[nemu] speechSynthesize failed; the page speaks with the local voice", error);
    return null;
  }
}
