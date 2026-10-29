// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vite-plus/test";

import { sendChatRequest } from "../../features/chat/api/chat-messaging";
import type { ChatResult } from "../../features/chat/lib/chat-message";
import { OPEN_COMPOSER_MESSAGE } from "../../features/composer/lib/open-composer-message";
import { NemuOverlay } from "./nemu-overlay";

const { messageListeners } = vi.hoisted(() => ({
  messageListeners: new Set<(message: unknown) => void>(),
}));

vi.mock("wxt/browser", () => ({
  browser: {
    runtime: {
      onMessage: {
        addListener: (listener: (message: unknown) => void) => messageListeners.add(listener),
        removeListener: (listener: (message: unknown) => void) => messageListeners.delete(listener),
      },
    },
  },
}));
vi.mock("../../features/chat/api/chat-messaging", () => ({ sendChatRequest: vi.fn() }));

const send = vi.mocked(sendChatRequest);
let requestSignal: AbortSignal | undefined;

beforeEach(() => {
  send.mockImplementation((_request, signal) => {
    requestSignal = signal;
    return new Promise<ChatResult>(() => undefined);
  });
});

afterEach(() => {
  cleanup();
  send.mockReset();
  requestSignal = undefined;
});

/** The toolbar icon or its shortcut, relayed by the background. */
function openComposer() {
  act(() => {
    for (const listener of messageListeners) listener(OPEN_COMPOSER_MESSAGE);
  });
}

function composerInput() {
  return screen.queryByRole("textbox", { name: "Pertanyaan untuk Nemu" });
}

function membaca() {
  return screen.queryByRole("status");
}

function ask(prompt: string) {
  openComposer();
  const input = composerInput()!;
  fireEvent.change(input, { target: { value: prompt } });
  fireEvent.keyDown(input, { key: "Enter" });
}

describe("NemuOverlay", () => {
  test("with a prompt loading and the Composer open, Esc closes only the Composer", () => {
    render(<NemuOverlay />);
    ask("Bagaimana cara mengajukan perjalanan dinas?");
    expect(membaca()).not.toBeNull();

    openComposer();
    fireEvent.keyDown(composerInput()!, { key: "Escape" });

    expect(composerInput()).toBeNull();
    expect(membaca()).not.toBeNull();
    expect(requestSignal?.aborted).toBe(false);
  });

  test("with the Composer closed, Esc cancels the loading prompt", () => {
    render(<NemuOverlay />);
    ask("Bagaimana cara mengajukan perjalanan dinas?");
    expect(membaca()).not.toBeNull();

    fireEvent.keyDown(window, { key: "Escape" });

    expect(membaca()).toBeNull();
    expect(requestSignal?.aborted).toBe(true);
  });
});
