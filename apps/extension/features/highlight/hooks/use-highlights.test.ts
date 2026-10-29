// @vitest-environment happy-dom
import type { NemuAction } from "@nemu/contracts";
import {
  momentOneFollowUpResponse,
  momentThreeFollowUpResponse,
  momentTwoResponse,
} from "@nemu/contracts/fixtures";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vite-plus/test";

import { useHighlights } from "./use-highlights";

function momentTwoAction(index: number): NemuAction {
  const action = momentTwoResponse.actions[index];
  if (!action) throw new Error(`The Momen 2 fixture has no action ${index}`);
  return action;
}

const notHotel = momentTwoAction(0);
const amount = momentTwoAction(1);

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

/** Renders a page element whose box the test moves, since happy-dom has no layout. */
function renderTarget(nemuId: string, tag: "button" | "input" = "button") {
  const element = document.createElement(tag);
  element.dataset.nemuId = nemuId;
  document.body.append(element);
  let box = new DOMRect(40, 300, 200, 32);
  element.getBoundingClientRect = () => box;
  const scrollIntoView = vi.fn();
  element.scrollIntoView = scrollIntoView;
  return {
    element,
    scrollIntoView,
    moveTo(next: DOMRect) {
      box = next;
    },
  };
}

function renderHighlights(actions: NemuAction[]) {
  return renderHook(() => useHighlights(actions)).result;
}

describe("useHighlights", () => {
  test("scrolls to the Momen 2 option and highlights it with its action label", async () => {
    const target = renderTarget(notHotel.target);

    const result = renderHighlights([notHotel]);

    await waitFor(() =>
      expect(result.current.highlight).toEqual({
        action: notHotel,
        box: { left: 40, top: 300, width: 200, height: 32 },
      }),
    );
    expect(target.scrollIntoView).toHaveBeenCalledOnce();
    expect(result.current.missing).toEqual([]);
  });

  test("stays attached when the page scrolls or the window resizes", async () => {
    const target = renderTarget(notHotel.target);
    const result = renderHighlights([notHotel]);
    await waitFor(() => expect(result.current.highlight).toBeDefined());

    target.moveTo(new DOMRect(40, 120, 200, 32));
    window.dispatchEvent(new Event("scroll"));
    await waitFor(() => expect(result.current.highlight?.box.top).toBe(120));

    target.moveTo(new DOMRect(16, 120, 160, 32));
    window.dispatchEvent(new Event("resize"));
    await waitFor(() =>
      expect(result.current.highlight?.box).toEqual({
        left: 16,
        top: 120,
        width: 160,
        height: 32,
      }),
    );
  });

  test("Momen 2 rings one step at a time and moves on when the user does each one", async () => {
    const option = renderTarget(notHotel.target);
    const nominal = renderTarget(amount.target, "input");
    const result = renderHighlights([notHotel, amount]);
    await waitFor(() => expect(result.current.highlight?.action).toEqual(notHotel));

    // Picking the option removes its ring and rings the nominal field instead.
    act(() => option.element.click());
    await waitFor(() => expect(result.current.highlight?.action).toEqual(amount));
    expect(nominal.scrollIntoView).toHaveBeenCalledOnce();

    // Filling in the last step leaves nothing ringed.
    act(() => {
      nominal.element.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await waitFor(() => expect(result.current.highlight).toBeUndefined());
  });

  test("the Momen 3 follow-up rings one step at a time, moving on as each upload is filled", async () => {
    const [laporan, boardingPass, kirim] = momentThreeFollowUpResponse.actions;
    if (!laporan || !boardingPass || !kirim) throw new Error("expected three Momen 3 actions");
    const laporanInput = renderTarget(laporan.target, "input");
    const boardingPassInput = renderTarget(boardingPass.target, "input");
    renderTarget(kirim.target);

    const result = renderHighlights(momentThreeFollowUpResponse.actions);

    await waitFor(() => expect(result.current.highlight?.action).toEqual(laporan));
    expect(result.current.steps.map(({ action }) => action)).toEqual([
      laporan,
      boardingPass,
      kirim,
    ]);

    // Clicking into the field only opens the file picker; choosing a file finishes the step.
    act(() => laporanInput.element.click());
    expect(result.current.stepIndex).toBe(0);
    act(() => {
      laporanInput.element.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await waitFor(() => expect(result.current.highlight?.action).toEqual(boardingPass));
    expect(boardingPassInput.scrollIntoView).toHaveBeenCalledOnce();

    act(() => {
      boardingPassInput.element.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await waitFor(() => expect(result.current.highlight?.action).toEqual(kirim));
  });

  test("a Select step moves on once an option picked in its popup shows on the trigger", async () => {
    const [jenis, kota] = momentOneFollowUpResponse.actions;
    if (!jenis || !kota) throw new Error("expected the Momen 1 follow-up's first two actions");
    const trigger = renderTarget(jenis.target);
    trigger.element.setAttribute("aria-haspopup", "listbox");
    trigger.element.textContent = "Pilih jenis perjalanan";
    renderTarget(kota.target, "input");
    const result = renderHighlights([jenis, kota]);
    await waitFor(() => expect(result.current.highlight?.action).toEqual(jenis));

    // Opening the popup only starts the step.
    act(() => trigger.element.click());
    expect(result.current.stepIndex).toBe(0);

    // The option is picked in the popup, outside the trigger, and the trigger shows it.
    act(() => {
      trigger.element.textContent = "Dinas luar kota";
    });
    await waitFor(() => expect(result.current.highlight?.action).toEqual(kota));
    expect(result.current.stepIndex).toBe(1);
  });

  test("pressing the only highlighted target ends the guide and removes its ring", async () => {
    const menu = renderTarget("menu-ajukan-perjalanan-dinas");
    const result = renderHighlights([
      {
        type: "highlight",
        target: "menu-ajukan-perjalanan-dinas",
        level: "arahkan",
        label: "Periksa ini",
      },
    ]);
    await waitFor(() => expect(result.current.highlight).toBeDefined());

    act(() => menu.element.click());

    await waitFor(() => expect(result.current.highlight).toBeUndefined());
  });

  test("reports a target missing from the page instead of throwing, and skips it", async () => {
    renderTarget(notHotel.target);

    const result = renderHighlights([amount, notHotel]);

    await waitFor(() => expect(result.current.highlight?.action).toEqual(notHotel));
    expect(result.current.steps).toEqual([{ action: notHotel, position: 1 }]);
    expect(result.current.missing).toEqual([amount]);
  });

  test("leaves click actions to their own runner", () => {
    renderTarget("menu-ajukan-perjalanan-dinas");

    const result = renderHighlights([
      {
        type: "click",
        target: "menu-ajukan-perjalanan-dinas",
        level: "jalan_sendiri",
        label: "Buka",
      },
    ]);

    expect(result.current.highlight).toBeUndefined();
    expect(result.current.steps).toEqual([]);
  });
});
