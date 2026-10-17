import type { NemuRequest } from "@nemu/contracts";
import { momentOneRequest, momentOneResponse } from "@nemu/contracts/fixtures";
import { ORPCError } from "@orpc/client";
import { describe, expect, test, vi } from "vite-plus/test";

import { CHAT_ERRORS } from "../lib/chat-message";
import { type NemuChatClient, requestNemuChat } from "./request-nemu-chat";

const DEMO_APP_PAGE = "http://localhost:3001/";

function fakeClient(respond: (request: NemuRequest) => Promise<unknown>) {
  const nemuChat = vi.fn(respond);
  const client: NemuChatClient = { nemuChat };
  return { client, nemuChat };
}

describe("requestNemuChat", () => {
  test("returns the Nemu Service answer and never sends user_id", async () => {
    const { client, nemuChat } = fakeClient(async () => momentOneResponse);

    const result = await requestNemuChat(client, momentOneRequest, DEMO_APP_PAGE);

    expect(result).toEqual({ kind: "response", response: momentOneResponse });
    expect(nemuChat).toHaveBeenCalledOnce();
    expect(nemuChat.mock.calls[0]?.[0]).not.toHaveProperty("user_id");
  });

  test("asks the user to log in when the Demo App session is missing", async () => {
    const { client } = fakeClient(async () => {
      throw new ORPCError("UNAUTHORIZED");
    });

    expect(await requestNemuChat(client, momentOneRequest, DEMO_APP_PAGE)).toEqual({
      kind: "unauthorized",
    });
  });

  test("reports a network failure as an error, not an answer", async () => {
    const { client } = fakeClient(async () => {
      throw new TypeError("Failed to fetch");
    });

    expect(await requestNemuChat(client, momentOneRequest, DEMO_APP_PAGE)).toEqual({
      kind: "error",
      message: CHAT_ERRORS.unreachable,
    });
  });

  test("reports a server failure or an off-contract reply as an error", async () => {
    const failing = fakeClient(async () => {
      throw new ORPCError("INTERNAL_SERVER_ERROR");
    });
    const malformed = fakeClient(async () => ({ status: "answer" }));

    for (const { client } of [failing, malformed]) {
      expect(await requestNemuChat(client, momentOneRequest, DEMO_APP_PAGE)).toEqual({
        kind: "error",
        message: CHAT_ERRORS.failed,
      });
    }
  });

  test.each([
    ["a page outside the allowlist", momentOneRequest, "https://example.com/"],
    ["a tab without a URL", momentOneRequest, undefined],
    ["an empty prompt", { ...momentOneRequest, prompt: "   " }, DEMO_APP_PAGE],
  ])("sends nothing to the server for %s", async (_name, request, pageUrl) => {
    const { client, nemuChat } = fakeClient(async () => momentOneResponse);

    const result = await requestNemuChat(client, request, pageUrl);

    expect(result.kind).toBe("error");
    expect(nemuChat).not.toHaveBeenCalled();
  });
});
