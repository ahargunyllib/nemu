// @vitest-environment happy-dom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vite-plus/test";

import { useLocationFollowUp } from "./use-location-follow-up";

const collector = vi.hoisted(() => vi.fn(async () => []));

vi.mock("../../element-list/lib/settled-element-list", () => ({
  collectSettledElementList: collector,
  pageNemuIds: () => document.body.dataset.page ?? "",
}));

beforeEach(() => {
  vi.useFakeTimers();
  collector.mockClear();
  window.history.replaceState(null, "", "/claims/1");
});

afterEach(() => vi.useRealTimers());

describe("useLocationFollowUp", () => {
  const session = {
    prompt: "SLA?",
    guideId: "sla-claim:contract",
    currentStep: 1,
    steps: [
      { id: "crm", target: "link-crm-layanan", label: "Buka CRM" },
      { id: "return", target: "link-kembali-task-klaim", label: "Kembali" },
    ],
    visitedSignatures: [],
  };

  test("continues an active guide after manual SPA navigation", async () => {
    const followUp = vi.fn();
    renderHook(() => useLocationFollowUp(session, followUp));

    window.history.pushState(null, "", "/crm/TN-ENT-002");
    await act(() => vi.advanceTimersByTimeAsync(200));

    expect(collector).toHaveBeenCalledOnce();
    expect(followUp).toHaveBeenCalledWith([]);
  });

  test("waits for the page it left to be replaced, not just for the new URL", async () => {
    document.body.dataset.page = "task-klaim";
    renderHook(() => useLocationFollowUp(session, vi.fn()));
    await act(() => vi.advanceTimersByTimeAsync(200));

    window.history.pushState(null, "", "/crm/TN-ENT-002");
    await act(() => vi.advanceTimersByTimeAsync(200));

    expect(collector).toHaveBeenCalledWith(expect.any(AbortSignal), { leaving: "task-klaim" });
    delete document.body.dataset.page;
  });

  test("does nothing when there is no active guide", async () => {
    renderHook(() => useLocationFollowUp(null, vi.fn()));

    window.history.pushState(null, "", "/crm/TN-ENT-002");
    await act(() => vi.advanceTimersByTimeAsync(200));

    expect(collector).not.toHaveBeenCalled();
  });

  test("does not restart a guide after its final navigation", async () => {
    renderHook(() =>
      useLocationFollowUp({ ...session, currentStep: session.steps.length }, vi.fn()),
    );

    window.history.pushState(null, "", "/claims/1");
    await act(() => vi.advanceTimersByTimeAsync(200));

    expect(collector).not.toHaveBeenCalled();
  });
});
