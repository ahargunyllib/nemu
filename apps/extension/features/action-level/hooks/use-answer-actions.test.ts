// @vitest-environment happy-dom
import type { NemuAction, PageElement } from "@nemu/contracts";
import {
  momentOneRequest,
  momentOneResponse,
  momentThreeFollowUpRequest,
  momentThreeFollowUpResponse,
  momentThreeRequest,
  momentThreeResponse,
} from "@nemu/contracts/fixtures";
import { NEMU_IDS } from "@nemu/contracts/nemu-ids";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vite-plus/test";

import {
  dasarPenugasanStep as dasar,
  jenisPerjalananStep as jenis,
  kotaTujuanStep as kota,
  lodgingAmountStep as amount,
  momentOneGuidedActions,
  momentTwoGuidedActions,
  notHotelStep as notHotel,
} from "../../guided-steps/lib/guided-fixtures";
import { DONE_MS } from "../../guided-steps/lib/guided-steps";
import { MAX_MOVE_MS, MORPH_MS } from "../../navigation-click/lib/navigation-click";
import { useAnswerActions } from "./use-answer-actions";

const START = { x: 900, y: 500 };

beforeEach(() => {
  window.history.replaceState(null, "", "/");
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  document.body.innerHTML = "";
});

/** Renders a page element whose box is fixed, since happy-dom has no layout. */
function renderTarget(nemuId: string, onClick: () => void = () => {}) {
  const element = document.createElement("button");
  element.dataset.nemuId = nemuId;
  element.getBoundingClientRect = () => new DOMRect(40, 300, 200, 32);
  element.scrollIntoView = vi.fn();
  const clicked = vi.fn(onClick);
  element.addEventListener("click", clicked);
  document.body.append(element);
  return { clicked };
}

/** A form field on the page, which the user fills by changing it. */
function renderField(nemuId: string) {
  const element = document.createElement("input");
  element.dataset.nemuId = nemuId;
  element.getBoundingClientRect = () => new DOMRect(40, 300, 200, 32);
  element.scrollIntoView = vi.fn();
  document.body.append(element);
  return {
    fill() {
      element.dispatchEvent(new Event("change", { bubbles: true }));
    },
  };
}

function renderActions(actions: NemuAction[], elementList: PageElement[]) {
  return renderHook(() => useAnswerActions(actions, elementList, START)).result;
}

describe("useAnswerActions", () => {
  test("Momen 1 opens the Ajukan Perjalanan Dinas form with a click", async () => {
    vi.useFakeTimers();
    const menu = renderTarget(NEMU_IDS.shell.menuAjukanPerjalananDinas, () =>
      window.history.pushState(null, "", "/perdin/baru"),
    );

    const result = renderActions(momentOneResponse.actions, momentOneRequest.elements);
    await act(() => vi.advanceTimersByTimeAsync(MORPH_MS + MAX_MOVE_MS + 100));

    expect(menu.clicked).toHaveBeenCalledOnce();
    expect(window.location.pathname).toBe("/perdin/baru");
    expect(result.current.outcome).toBe("succeeded");
    expect(result.current.cursor?.mascot).toBe("success");
    expect(result.current.highlight).toBeUndefined();
  });

  test("Momen 3 reports the task click once it opens the task page", async () => {
    vi.useFakeTimers();
    renderTarget(NEMU_IDS.task.pertanggungjawaban, () =>
      window.history.pushState(null, "", "/perdin/task/PD-2026-0042"),
    );

    const result = renderActions(momentThreeResponse.actions, momentThreeRequest.elements);
    expect(result.current.clicked).toBeUndefined();
    await act(() => vi.advanceTimersByTimeAsync(MORPH_MS + MAX_MOVE_MS + 100));

    expect(result.current.clicked?.target).toBe(NEMU_IDS.task.pertanggungjawaban);
  });

  test("the Momen 3 follow-up steps through both uploads, then Kirim as the user's to press", async () => {
    const targets = momentThreeFollowUpResponse.actions.map(({ target }) => renderTarget(target));

    const result = renderActions(
      momentThreeFollowUpResponse.actions,
      momentThreeFollowUpRequest.elements,
    );

    await waitFor(() =>
      expect(result.current.highlight?.action.target).toBe(
        NEMU_IDS.pertanggungjawaban.uploadLaporanPerjalanan,
      ),
    );
    expect(result.current.steps.map(({ target, label }) => [target, label])).toEqual([
      [NEMU_IDS.pertanggungjawaban.uploadLaporanPerjalanan, "Unggah dokumen ini"],
      [NEMU_IDS.pertanggungjawaban.uploadBoardingPassPulang, "Unggah dokumen ini"],
      [NEMU_IDS.pertanggungjawaban.kirim, "Kamu yang mengirim"],
    ]);
    expect(result.current.cursor).toBeNull();
    for (const { clicked } of targets) expect(clicked).not.toHaveBeenCalled();
  });

  test("a fake answer that clicks Kirim highlights it and never clicks", async () => {
    const kirim = renderTarget(NEMU_IDS.pertanggungjawaban.kirim);
    const clickKirim: NemuAction = {
      type: "click",
      target: NEMU_IDS.pertanggungjawaban.kirim,
      level: "jalan_sendiri",
      label: "Kirim",
    };

    const result = renderActions([clickKirim], momentThreeFollowUpRequest.elements);

    await waitFor(() =>
      expect(result.current.highlight?.action).toEqual({
        ...clickKirim,
        type: "highlight",
        level: "arahkan",
      }),
    );
    expect(result.current.cursor).toBeNull();
    expect(kirim.clicked).not.toHaveBeenCalled();
  });

  test("a click on a target outside the Element List becomes a highlight", async () => {
    const menu = renderTarget(NEMU_IDS.shell.menuAjukanPerjalananDinas);

    const result = renderActions(momentOneResponse.actions, []);

    await waitFor(() => expect(result.current.highlight).toBeDefined());
    expect(menu.clicked).not.toHaveBeenCalled();
  });

  test("Esc stops the click and highlights the target instead", async () => {
    vi.useFakeTimers();
    const menu = renderTarget(NEMU_IDS.shell.menuAjukanPerjalananDinas);
    const result = renderActions(momentOneResponse.actions, momentOneRequest.elements);

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    await act(() => vi.advanceTimersByTimeAsync(MORPH_MS + MAX_MOVE_MS + 100));

    expect(menu.clicked).not.toHaveBeenCalled();
    expect(result.current.outcome).toBe("stopped");
    expect(result.current.cursor).toBeNull();
    expect(result.current.highlight).toBeDefined();
  });

  test("a missing click target warns and falls back to a highlight", async () => {
    vi.useFakeTimers();
    const result = renderActions(momentOneResponse.actions, momentOneRequest.elements);

    await act(() => vi.advanceTimersByTimeAsync(0));

    expect(result.current.outcome).toBe("missing");
    expect(result.current.cursor?.mascot).toBe("warning");
    expect(result.current.missing.map(({ target }) => target)).toEqual([
      NEMU_IDS.shell.menuAjukanPerjalananDinas,
    ]);
  });

  test("Momen 1 guided: clicks Perjalanan Dinas, waits for the form, then guides its fields", async () => {
    vi.useFakeTimers();
    renderTarget(NEMU_IDS.favoriteProcess.perjalananDinas, () => {
      window.history.pushState(null, "", "/perdin/baru");
      // The form renders a moment after the route changes.
      setTimeout(() => {
        for (const { target } of [jenis, kota, dasar]) renderField(target);
      }, 400);
    });

    const result = renderActions(momentOneGuidedActions, [
      {
        nemu_id: NEMU_IDS.favoriteProcess.perjalananDinas,
        label: "Perjalanan Dinas",
        role: "link",
        visible: true,
      },
    ]);
    expect(result.current.guided).toBe(true);
    expect(result.current.searching).toBe(true);

    await act(() => vi.advanceTimersByTimeAsync(MORPH_MS + MAX_MOVE_MS + 100));
    expect(result.current.outcome).toBe("succeeded");
    expect(result.current.highlight).toBeUndefined();

    await act(() => vi.advanceTimersByTimeAsync(1_000));
    expect(result.current.searching).toBe(false);
    expect(result.current.missing).toEqual([]);
    expect(result.current.steps.map(({ target }) => target)).toEqual([
      jenis.target,
      kota.target,
      dasar.target,
    ]);
    expect(result.current.highlight?.action).toEqual(jenis);
  });

  test("Momen 2 guided: each filled step shows success for a moment, then the next starts", async () => {
    vi.useFakeTimers();
    const notHotelField = renderField(notHotel.target);
    const amountField = renderField(amount.target);

    const result = renderActions(momentTwoGuidedActions, []);
    await act(() => vi.advanceTimersByTimeAsync(20));
    expect(result.current.highlight?.action).toEqual(notHotel);
    expect(result.current.stepIndex).toBe(0);

    act(() => notHotelField.fill());
    expect(result.current.done).toBe(true);
    expect(result.current.highlight?.action).toEqual(notHotel);

    await act(() => vi.advanceTimersByTimeAsync(DONE_MS + 20));
    expect(result.current.done).toBe(false);
    expect(result.current.stepIndex).toBe(1);
    expect(result.current.highlight?.action).toEqual(amount);

    act(() => amountField.fill());
    expect(result.current.done).toBe(true);
    await act(() => vi.advanceTimersByTimeAsync(DONE_MS + 20));
    // Past the last step the guide ends: no outline, label, or card.
    expect(result.current.highlight).toBeUndefined();
  });
});
