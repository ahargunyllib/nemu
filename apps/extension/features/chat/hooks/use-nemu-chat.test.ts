// @vitest-environment happy-dom
import {
  momentOneRequest,
  momentThreeFollowUpRequest,
  momentThreeFollowUpResponse,
  momentThreeRequest,
  momentThreeResponse,
  momentTwoRequest,
  momentTwoResponse,
} from "@nemu/contracts/fixtures";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vite-plus/test";

import { collectSettledElementList } from "../../element-list/lib/settled-element-list";
import { sendChatRequest } from "../api/chat-messaging";
import { useNemuChat } from "./use-nemu-chat";

vi.mock("../api/chat-messaging", () => ({ sendChatRequest: vi.fn() }));
vi.mock("../../element-list/lib/settled-element-list", () => ({
  collectSettledElementList: vi.fn(),
}));

const send = vi.mocked(sendChatRequest);
const collectSettled = vi.mocked(collectSettledElementList);

beforeEach(() => {
  send.mockResolvedValue({ kind: "response", response: momentTwoResponse });
});

afterEach(() => {
  cleanup();
  send.mockReset();
  collectSettled.mockReset();
  window.history.replaceState(null, "", "/");
});

describe("useNemuChat", () => {
  const { prompt, elements, screenshot_crop: crop } = momentTwoRequest;

  test("sends the attached Area Crop as screenshot_crop", async () => {
    const { result } = renderHook(() => useNemuChat());

    await act(() => result.current.send(prompt, elements, crop));

    expect(send).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ prompt, elements, screenshot_crop: crop }),
    );
    expect(result.current.state).toMatchObject({ kind: "response", screenshotCrop: crop });
  });

  test("sends no screenshot_crop without an Area Crop", async () => {
    const { result } = renderHook(() => useNemuChat());

    await act(() => result.current.send(prompt, elements));

    expect(send.mock.calls[0]?.[0]).not.toHaveProperty("screenshot_crop");
  });

  test("a follow-up asks the same question with the new page's Element List, once", async () => {
    send
      .mockResolvedValueOnce({ kind: "response", response: momentThreeResponse })
      .mockResolvedValue({ kind: "response", response: momentThreeFollowUpResponse });
    const { result } = renderHook(() => useNemuChat());

    await act(() => result.current.send(momentThreeRequest.prompt, momentThreeRequest.elements));
    await act(() => result.current.followUp(momentThreeFollowUpRequest.elements));
    await act(() => result.current.followUp(momentThreeFollowUpRequest.elements));

    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[1]?.[0]).toMatchObject({
      prompt: momentThreeRequest.prompt,
      elements: momentThreeFollowUpRequest.elements,
    });
    expect(result.current.state).toMatchObject({
      kind: "response",
      response: momentThreeFollowUpResponse,
      elements: momentThreeFollowUpRequest.elements,
    });
  });

  test("a follow-up leaves the previous page's Area Crop behind", async () => {
    const { result } = renderHook(() => useNemuChat());

    await act(() => result.current.send(prompt, elements, crop));
    await act(() => result.current.followUp(momentThreeFollowUpRequest.elements));

    expect(send.mock.calls[1]?.[0]).not.toHaveProperty("screenshot_crop");
  });

  test("a new question gets its own follow-up", async () => {
    const { result } = renderHook(() => useNemuChat());

    await act(() => result.current.send(momentThreeRequest.prompt, momentThreeRequest.elements));
    await act(() => result.current.followUp([]));
    await act(() => result.current.send(momentOneRequest.prompt, momentOneRequest.elements));
    await act(() => result.current.followUp([]));

    expect(send.mock.calls.map(([request]) => request.prompt)).toEqual([
      momentThreeRequest.prompt,
      momentThreeRequest.prompt,
      momentOneRequest.prompt,
      momentOneRequest.prompt,
    ]);
  });

  test("nothing follows up after the card is closed", async () => {
    const { result } = renderHook(() => useNemuChat());

    await act(() => result.current.send(momentThreeRequest.prompt, momentThreeRequest.elements));
    act(() => result.current.reset());
    await act(() => result.current.followUp(momentThreeFollowUpRequest.elements));

    expect(send).toHaveBeenCalledOnce();
    expect(result.current.state.kind).toBe("idle");
  });

  test("asks again from the page Rina went to while Nemu was reading", async () => {
    window.history.replaceState(null, "", "/perdin/baru");
    send.mockImplementationOnce(async () => {
      // The side menu takes Rina to Beranda before the answer for the form arrives.
      window.history.pushState(null, "", "/");
      return { kind: "response", response: momentTwoResponse };
    });
    send.mockResolvedValue({ kind: "response", response: momentThreeResponse });
    collectSettled.mockResolvedValue(momentThreeRequest.elements);
    const { result } = renderHook(() => useNemuChat());

    await act(() => result.current.send(momentThreeRequest.prompt, elements, crop));

    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[1]?.[0]).toMatchObject({
      url: window.location.href,
      prompt: momentThreeRequest.prompt,
      elements: momentThreeRequest.elements,
    });
    expect(send.mock.calls[1]?.[0]).not.toHaveProperty("screenshot_crop");
    expect(result.current.state).toMatchObject({
      kind: "response",
      response: momentThreeResponse,
      elements: momentThreeRequest.elements,
    });
  });
});
