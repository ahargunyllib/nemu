import type { ActionLogEntry } from "@nemu/contracts/executor";
import type { PageSnapshot } from "@nemu/contracts/school";

import type { GradePhotoRequest } from "../../features/grade-photo/lib/requests";
import type { ProcessRunRequest } from "../../features/process-run/lib/requests";
import type { QuizCheckRequest } from "../../features/quiz-check/lib/requests";
import type { QuizImportRequest } from "../../features/quiz-import/lib/requests";
import type { RecorderRequest } from "../../features/recorder/lib/requests";

/**
 * What the page found about who is signed in: the email a per-site reader saw (null when signed
 * out), or `unreadable` on a site that shows no AlurSekolah account (Ruang GTK, Moodle).
 */
export type PageEmail = { kind: "read"; email: string | null } | { kind: "unreadable" };

/** Messages from the content script to the background, which alone calls the Nemu Service. */
export type NemuMessage =
  | { type: "nemu:site-access"; url: string }
  | { type: "nemu:identify"; pageEmail: PageEmail }
  // `snapshot` is null while a password field is on screen (F2-07).
  | { type: "nemu:ask"; pageEmail: PageEmail; question: string; snapshot: PageSnapshot | null }
  // Sumber (#258): open a cited document at its page in a new tab.
  | { type: "nemu:open-source"; pageEmail: PageEmail; docId: string; page: number | null }
  // Hold to talk (#200): the background records through the offscreen document.
  | { type: "nemu:listen-start" }
  | { type: "nemu:listen-stop"; pageEmail: PageEmail }
  | { type: "nemu:listen-cancel" }
  | { type: "nemu:speak"; pageEmail: PageEmail; text: string }
  // The executor (#202): its run per tab and the last Catatan langkah live in
  // `chrome.storage.session`, which only the background reads; actions go to the action log.
  | { type: "nemu:run-save"; state: unknown }
  | { type: "nemu:run-load" }
  | { type: "nemu:notes-save"; notes: { title: string; items: string[] } }
  | { type: "nemu:notes-load" }
  | { type: "nemu:log-actions"; pageEmail: PageEmail; entries: ActionLogEntry[] }
  // F1 (#207): the WhatsApp photo, its questions, the fill's rules and the read-back.
  | { type: "nemu:grade-photo"; pageEmail: PageEmail; request: GradePhotoRequest }
  // F3 (#213): an uploaded BPMN process, its photo and the page's labels.
  | { type: "nemu:process-run"; pageEmail: PageEmail; request: ProcessRunRequest }
  // F3-01 (#214): "Rekam cara", handed to the Nemu Service for the operator's review.
  | { type: "nemu:recorder"; pageEmail: PageEmail; request: RecorderRequest }
  // F4-01 (#209): checking a Moodle quiz; judgement checks come from the Nemu Service (#218).
  | { type: "nemu:quiz-check"; pageEmail: PageEmail; request: QuizCheckRequest }
  // F4-03 (#210): the teacher's script, read into a quiz by the Nemu Service (#219).
  | { type: "nemu:quiz-import"; pageEmail: PageEmail; request: QuizImportRequest };

const TYPES: ReadonlySet<string> = new Set([
  "nemu:site-access",
  "nemu:identify",
  "nemu:ask",
  "nemu:open-source",
  "nemu:listen-start",
  "nemu:listen-stop",
  "nemu:listen-cancel",
  "nemu:speak",
  "nemu:run-save",
  "nemu:run-load",
  "nemu:notes-save",
  "nemu:notes-load",
  "nemu:log-actions",
  "nemu:grade-photo",
  "nemu:process-run",
  "nemu:recorder",
  "nemu:quiz-check",
  "nemu:quiz-import",
]);

export function isNemuMessage(message: unknown): message is NemuMessage {
  return (
    typeof message === "object" &&
    message !== null &&
    "type" in message &&
    typeof message.type === "string" &&
    TYPES.has(message.type)
  );
}

/** Messages from the background to the offscreen document, which holds the microphone. */
export type OffscreenMessage = {
  target: "nemu-offscreen";
  type: "record-start" | "record-stop" | "record-cancel";
};

export function isOffscreenMessage(message: unknown): message is OffscreenMessage {
  return (
    typeof message === "object" &&
    message !== null &&
    "target" in message &&
    message.target === "nemu-offscreen"
  );
}

/** What the offscreen document answers to `record-start`. */
export type RecordStart = "recording" | "denied" | "unavailable";

/** What it answers to `record-stop`: the recording ready for `speechTranscribe`, or nothing. */
export type Recording = { audioBase64: string; format: "wav" | "webm" } | null;
