import { momentOneRequest } from "@nemu/contracts/fixtures";
import { beforeEach, describe, expect, test, vi } from "vite-plus/test";

const { sendMessage } = vi.hoisted(() => ({ sendMessage: vi.fn() }));

vi.mock("wxt/browser", () => ({ browser: { runtime: { sendMessage } } }));

import { sendChatRequest } from "./chat-messaging";

beforeEach(() => sendMessage.mockReset());

describe("sendChatRequest", () => {
  test("aborting sends a matching cancellation message and resolves invisibly", async () => {
    sendMessage
      .mockImplementationOnce(() => new Promise(() => undefined))
      .mockResolvedValueOnce(undefined);
    const controller = new AbortController();

    const pending = sendChatRequest(momentOneRequest, controller.signal);
    controller.abort();
    await Promise.resolve();

    const requestMessage = sendMessage.mock.calls[0]?.[0];
    expect(requestMessage).toMatchObject({ type: "nemu:chat", request: momentOneRequest });
    expect(requestMessage.requestId).toEqual(expect.any(String));
    expect(sendMessage.mock.calls[1]?.[0]).toEqual({
      type: "nemu:chat:cancel",
      requestId: requestMessage.requestId,
    });
    await expect(pending).resolves.toBeUndefined();
  });
});
