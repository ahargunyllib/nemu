// @vitest-environment happy-dom
import type { NemuAction, PageElement } from "@nemu/contracts";
import {
  momentOneRequest,
  momentOneResponse,
  momentThreeFollowUpRequest,
} from "@nemu/contracts/fixtures";
import { NEMU_IDS } from "@nemu/contracts/nemu-ids";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vite-plus/test";

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
    expect(result.current.highlights).toEqual([]);
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
      expect(result.current.highlights.map(({ action }) => action)).toEqual([
        { ...clickKirim, type: "highlight", level: "arahkan" },
      ]),
    );
    expect(result.current.cursor).toBeNull();
    expect(kirim.clicked).not.toHaveBeenCalled();
  });

  test("a click on a target outside the Element List becomes a highlight", async () => {
    const menu = renderTarget(NEMU_IDS.shell.menuAjukanPerjalananDinas);

    const result = renderActions(momentOneResponse.actions, []);

    await waitFor(() => expect(result.current.highlights).toHaveLength(1));
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
    expect(result.current.highlights).toHaveLength(1);
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
});
