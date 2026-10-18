import { type NemuRequest, type NemuResponse, nemuResponseSchema } from "@nemu/contracts";
import { z } from "zod";

import type { NemuService } from "../../context";
import type { ChatLogRepository, NewChatLogRecord } from "./repository";

export type ChatDeps = {
  nemu: NemuService;
  chatLog: ChatLogRepository;
};

export const CHAT_LOG_LIMIT = 200;

type ChatOutcome = Pick<NewChatLogRecord, "status" | "result" | "citations" | "actions">;

// Hands the request to the Responder as the signed-in user and writes one Chat Log
// entry for it, including when the Responder fails or returns an invalid response.
export async function answerChat(
  { nemu, chatLog }: ChatDeps,
  request: NemuRequest,
  userId: string,
): Promise<NemuResponse> {
  const startedAt = Date.now();
  const record = (outcome: ChatOutcome) =>
    writeChatLog(chatLog, {
      id: crypto.randomUUID(),
      userId,
      sessionId: request.session_id,
      url: request.url,
      prompt: request.prompt,
      hasAreaCrop: Boolean(request.screenshot_crop),
      durationMs: Date.now() - startedAt,
      ...outcome,
    });

  let response: NemuResponse;
  try {
    response = nemuResponseSchema.parse(
      await nemu.respond({ ...request, user_id: userId }, userId),
    );
  } catch (error) {
    await record({
      status: "error",
      result: describeError(error),
      citations: [],
      actions: [],
    });
    throw error;
  }

  await record({
    status: response.status,
    result: response.answer.ringkas,
    citations: response.citations,
    actions: response.actions,
  });
  return response;
}

// Admins read this in the Chat Log, so a validation failure is listed issue by
// issue instead of as the ZodError's raw JSON.
function describeError(error: unknown): string {
  if (error instanceof z.ZodError) return z.prettifyError(error);
  return error instanceof Error ? error.message : String(error);
}

// A failed log write must not cost the user their answer.
async function writeChatLog(chatLog: ChatLogRepository, record: NewChatLogRecord) {
  try {
    await chatLog.insert(record);
  } catch (error) {
    console.error("Writing the Chat Log failed", error);
  }
}

export function listChatLog({ chatLog }: Pick<ChatDeps, "chatLog">) {
  return chatLog.listNewest(CHAT_LOG_LIMIT);
}
