import { type NemuRequest, nemuRequestSchema, nemuResponseSchema } from "@nemu/contracts";
import { ORPCError } from "@orpc/client";

import { isAllowedPage } from "../../../shared/lib/config";
import { CHAT_ERRORS, type ChatResult } from "../lib/chat-message";

/** The reply is `unknown` until it passes the contract: the wire may carry anything. */
export type NemuChatClient = {
  nemuChat(request: NemuRequest): Promise<unknown>;
};

/**
 * Sends a content-script request to `nemuChat` and maps every outcome to a
 * `ChatResult`, so a failure never reaches the Answer Card as an answer.
 */
export async function requestNemuChat(
  client: NemuChatClient,
  request: unknown,
  pageUrl: string | undefined,
): Promise<ChatResult> {
  if (!isAllowedPage(pageUrl)) return { kind: "error", message: CHAT_ERRORS.notAllowed };

  const parsed = nemuRequestSchema.safeParse(request);
  if (!parsed.success) return { kind: "error", message: CHAT_ERRORS.invalidRequest };

  // The Nemu Service takes the user from the Demo App session, never from the body.
  const input: NemuRequest = { ...parsed.data };
  delete input.user_id;

  try {
    const response = nemuResponseSchema.parse(await client.nemuChat(input));
    return { kind: "response", response };
  } catch (error) {
    if (error instanceof ORPCError && error.code === "UNAUTHORIZED")
      return { kind: "unauthorized" };
    console.error("[nemu] nemuChat failed", error);
    return {
      kind: "error",
      message: error instanceof TypeError ? CHAT_ERRORS.unreachable : CHAT_ERRORS.failed,
    };
  }
}
