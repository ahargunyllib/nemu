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
  | { type: "nemu:ask"; pageEmail: PageEmail; question: string; snapshot: ScreenSnapshot };

const TYPES: ReadonlySet<string> = new Set(["nemu:site-access", "nemu:identify", "nemu:ask"]);

export function isNemuMessage(message: unknown): message is NemuMessage {
  return (
    typeof message === "object" &&
    message !== null &&
    "type" in message &&
    typeof message.type === "string" &&
    TYPES.has(message.type)
  );
}
