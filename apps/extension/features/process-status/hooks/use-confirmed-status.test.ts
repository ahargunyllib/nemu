// @vitest-environment happy-dom
import type { ProcessInstanceStatus } from "@nemu/contracts/process-instance";
import { momentThreeFollowUpResponse, momentTwoResponse } from "@nemu/contracts/fixtures";
import { NEMU_IDS } from "@nemu/contracts/nemu-ids";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vite-plus/test";

import { fetchProcessInstance } from "../api/process-instance-messaging";
import { POLL_MS } from "../lib/wait-for-state-change";
import { useConfirmedStatus } from "./use-confirmed-status";

vi.mock("../api/process-instance-messaging", () => ({ fetchProcessInstance: vi.fn() }));

const fetchInstance = vi.mocked(fetchProcessInstance);

const IN_PERTANGGUNGJAWABAN: ProcessInstanceStatus = {
  id: "PD-2026-0042",
  state: "Pertanggungjawaban",
  activeTask: { id: "PJ-PD-2026-0042", label: "Pertanggungjawaban" },
};
const IN_VERIFIKASI: ProcessInstanceStatus = {
  id: "PD-2026-0042",
  state: "Verifikasi",
  activeTask: null,
};

beforeEach(() => {
  vi.useFakeTimers();
  window.history.replaceState(null, "", "/perdin/task/PD-2026-0042");
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  fetchInstance.mockReset();
  document.body.innerHTML = "";
});

function renderKirim() {
  const kirim = document.createElement("button");
  kirim.dataset.nemuId = NEMU_IDS.pertanggungjawaban.kirim;
  kirim.append(document.createElement("span"));
  document.body.append(kirim);
  return kirim;
}

describe("useConfirmedStatus", () => {
  test("after Rina presses Kirim, shows the task ID and the Verifikasi status", async () => {
    const kirim = renderKirim();
    fetchInstance
      .mockResolvedValueOnce(IN_PERTANGGUNGJAWABAN)
      .mockResolvedValueOnce(IN_PERTANGGUNGJAWABAN)
      .mockResolvedValue(IN_VERIFIKASI);
    const { result } = renderHook(() => useConfirmedStatus(momentThreeFollowUpResponse.actions));

    await act(() => vi.advanceTimersByTimeAsync(POLL_MS * 3));
    expect(result.current).toBeNull();

    // The press lands on the button's content, as a real click usually does.
    act(() => kirim.firstElementChild?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    await act(() => vi.advanceTimersByTimeAsync(POLL_MS * 3));

    expect(result.current).toEqual({ taskId: "PJ-PD-2026-0042", state: "Verifikasi" });
    expect(fetchInstance).toHaveBeenCalledWith("PD-2026-0042");
  });

  test("shows nothing when Kirim is refused and the State stays", async () => {
    const kirim = renderKirim();
    fetchInstance.mockResolvedValue(IN_PERTANGGUNGJAWABAN);
    const { result } = renderHook(() => useConfirmedStatus(momentThreeFollowUpResponse.actions));

    act(() => kirim.click());
    await act(() => vi.advanceTimersByTimeAsync(15_000));

    expect(result.current).toBeNull();
  });

  test("reads nothing for an answer without a confirm", async () => {
    renderHook(() => useConfirmedStatus(momentTwoResponse.actions));
    await act(() => vi.advanceTimersByTimeAsync(POLL_MS));

    expect(fetchInstance).not.toHaveBeenCalled();
  });
});
