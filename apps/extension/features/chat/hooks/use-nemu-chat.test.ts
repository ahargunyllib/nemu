// @vitest-environment happy-dom
import { momentTwoRequest, momentTwoResponse } from "@nemu/contracts/fixtures";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vite-plus/test";

import { sendChatRequest } from "../api/chat-messaging";
import { useNemuChat } from "./use-nemu-chat";

vi.mock("../api/chat-messaging", () => ({
  sendChatRequest: vi.fn(async () => ({ kind: "response", response: momentTwoResponse })),
}));

afterEach(() => {
  cleanup();
  vi.mocked(sendChatRequest).mockClear();
});

const { prompt, elements, screenshot_crop: crop } = momentTwoRequest;

describe("useNemuChat", () => {
  test("sends the attached Area Crop as screenshot_crop", async () => {
    const { result } = renderHook(() => useNemuChat());

    await act(() => result.current.send(prompt, elements, crop));

    expect(sendChatRequest).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ prompt, elements, screenshot_crop: crop }),
    );
    expect(result.current.state).toMatchObject({ kind: "response", screenshotCrop: crop });
  });

  test("sends no screenshot_crop without an Area Crop", async () => {
    const { result } = renderHook(() => useNemuChat());

    await act(() => result.current.send(prompt, elements));

    expect(vi.mocked(sendChatRequest).mock.calls[0]?.[0]).not.toHaveProperty("screenshot_crop");
  });
});
