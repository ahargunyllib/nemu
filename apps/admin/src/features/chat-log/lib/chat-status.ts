import type { ChatLogEntry } from "@nemu/api/modules/chat/repository";

export type ChatStatus = ChatLogEntry["status"];

export const CHAT_STATUS_LABELS: Record<ChatStatus, string> = {
  answer: "Answered",
  clarify: "Clarifying",
  refuse: "Refused",
  error: "Error",
};
