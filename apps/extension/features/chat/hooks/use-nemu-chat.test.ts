// @vitest-environment happy-dom
import {
  momentOneRequest,
  momentOneResponse,
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
      expect.any(AbortSignal),
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

  test("a guide continues with the new page elements once per URL and server step", async () => {
    const formElements = [
      {
        nemu_id: "select-jenis-perjalanan",
        label: "Jenis perjalanan",
        role: "combobox",
        visible: true,
      },
    ];
    const advanced = {
      ...momentOneResponse,
      guide: { ...momentOneResponse.guide, current_step: 2 },
    };
    send
      .mockResolvedValueOnce({ kind: "response", response: momentOneResponse })
      .mockResolvedValue({ kind: "response", response: advanced });
    window.history.replaceState({}, "", "/perdin/baru#form");
    const { result } = renderHook(() => useNemuChat());

    await act(() => result.current.send(momentOneRequest.prompt, momentOneRequest.elements));
    await act(() => result.current.followUp(formElements));
    await act(() => result.current.followUp(formElements));
    await act(() => result.current.followUp(formElements));

    expect(send).toHaveBeenCalledTimes(3);
    expect(send.mock.calls[1]?.[0]).toMatchObject({
      prompt: momentOneRequest.prompt,
      elements: formElements,
    });
    expect(result.current.guideSession).toMatchObject({
      guideId: "travel-request:create",
      currentStep: 2,
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

  test("cancel aborts a pending answer and its late completion stays hidden", async () => {
    let finish: ((result: Awaited<ReturnType<typeof sendChatRequest>>) => void) | undefined;
    let requestSignal: AbortSignal | undefined;
    send.mockImplementationOnce((_request, signal) => {
      requestSignal = signal;
      return new Promise((resolve) => {
        finish = resolve;
      });
    });
    const { result } = renderHook(() => useNemuChat());

    let pending: Promise<void> | undefined;
    act(() => {
      pending = result.current.send(prompt, elements);
    });
    expect(result.current.state.kind).toBe("loading");

    act(() => result.current.cancel());

    expect(requestSignal?.aborted).toBe(true);
    expect(result.current.state.kind).toBe("idle");

    finish?.({ kind: "response", response: momentTwoResponse });
    await act(async () => pending);
    expect(result.current.state.kind).toBe("idle");
  });
});
