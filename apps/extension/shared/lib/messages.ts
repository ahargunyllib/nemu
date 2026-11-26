import type { ScreenSnapshot } from "@nemu/contracts/school";

/**
 * What the page found about who is signed in: the email a per-site reader saw (null when signed
 * out), or `unreadable` on a site that shows no AlurSekolah account (Ruang GTK, Moodle).
 */
export type PageEmail = { kind: "read"; email: string | null } | { kind: "unreadable" };

/** Messages from the content script to the background, which alone calls the Nemu Service. */
export type NemuMessage =
  | { type: "nemu:site-access"; url: string }
  | { type: "nemu:identify"; pageEmail: PageEmail }
  | { type: "nemu:ask"; pageEmail: PageEmail; question: string; snapshot: ScreenSnapshot }
  // Hold to talk (#200): the background records through the offscreen document.
  | { type: "nemu:listen-start" }
  | { type: "nemu:listen-stop"; pageEmail: PageEmail }
  | { type: "nemu:listen-cancel" }
  | { type: "nemu:speak"; pageEmail: PageEmail; text: string };

const TYPES: ReadonlySet<string> = new Set([
  "nemu:site-access",
  "nemu:identify",
  "nemu:ask",
  "nemu:listen-start",
  "nemu:listen-stop",
  "nemu:listen-cancel",
  "nemu:speak",
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
