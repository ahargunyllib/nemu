// @vitest-environment happy-dom
import { momentTwoRequest, momentTwoResponse } from "@nemu/contracts/fixtures";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vite-plus/test";

import { sendChatRequest } from "../api/chat-messaging";
import type { ChatResult } from "../lib/chat-message";
import { useCancelOnEscape } from "./use-cancel-on-escape";
import { useNemuChat } from "./use-nemu-chat";

vi.mock("../api/chat-messaging", () => ({ sendChatRequest: vi.fn() }));

const send = vi.mocked(sendChatRequest);

afterEach(() => {
  cleanup();
  send.mockReset();
});

function pressEscape() {
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
}

/** The chat as the overlay wires it: Esc cancels only while Membaca shows. */
function useChatCancelledOnEscape() {
  const chat = useNemuChat();
  useCancelOnEscape(chat.state.kind === "loading", chat.reset);
  return chat;
}

describe("useCancelOnEscape", () => {
  const { prompt, elements } = momentTwoRequest;

  test("Esc while loading returns to idle and drops the late answer", async () => {
    const { promise, resolve } = Promise.withResolvers<ChatResult>();
    send.mockReturnValue(promise);
    const { result } = renderHook(useChatCancelledOnEscape);

    let sent: Promise<void> | undefined;
    act(() => {
      sent = result.current.send(prompt, elements);
    });
    expect(result.current.state.kind).toBe("loading");

    act(pressEscape);
    expect(result.current.state.kind).toBe("idle");

    await act(async () => {
      resolve({ kind: "response", response: momentTwoResponse });
      await sent;
    });
    expect(result.current.state.kind).toBe("idle");
  });

  test("Esc after the answer arrives leaves it on screen", async () => {
    send.mockResolvedValue({ kind: "response", response: momentTwoResponse });
    const { result } = renderHook(useChatCancelledOnEscape);

    await act(() => result.current.send(prompt, elements));
    act(pressEscape);

    expect(result.current.state.kind).toBe("response");
  });
});
