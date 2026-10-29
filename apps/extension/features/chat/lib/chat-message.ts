import type { NemuRequest, NemuResponse } from "@nemu/contracts";

/** Asks the background to call `nemuChat` with the Demo App session. */
export type ChatRequestMessage = {
  type: "nemu:chat";
  requestId: string;
  request: Omit<NemuRequest, "user_id">;
};

export type ChatCancelMessage = {
  type: "nemu:chat:cancel";
  requestId: string;
};

export type ChatResult =
  | { kind: "response"; response: NemuResponse }
  | { kind: "unauthorized" }
  | { kind: "error"; message: string };

export const CHAT_ERRORS = {
  notAllowed: "Nemu hanya aktif di Demo App.",
  invalidRequest: "Pertanyaan ini tidak bisa dikirim. Coba tulis ulang.",
  unreachable: "Nemu Service tidak bisa dihubungi. Periksa koneksi lalu coba lagi.",
  failed: "Nemu gagal menjawab. Coba lagi sebentar lagi.",
} as const;

export function isChatRequestMessage(message: unknown): message is ChatRequestMessage {
  return (
    typeof message === "object" &&
    message !== null &&
    "type" in message &&
    message.type === "nemu:chat" &&
    "requestId" in message &&
    typeof message.requestId === "string"
  );
}

export function isChatCancelMessage(message: unknown): message is ChatCancelMessage {
  return (
    typeof message === "object" &&
    message !== null &&
    "type" in message &&
    message.type === "nemu:chat:cancel" &&
    "requestId" in message &&
    typeof message.requestId === "string"
  );
}

export function isChatResult(value: unknown): value is ChatResult {
  if (typeof value !== "object" || value === null || !("kind" in value)) return false;
  return value.kind === "response" || value.kind === "unauthorized" || value.kind === "error";
}
