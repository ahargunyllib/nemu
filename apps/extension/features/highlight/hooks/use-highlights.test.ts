// @vitest-environment happy-dom
import type { NemuAction } from "@nemu/contracts";
import { momentTwoResponse } from "@nemu/contracts/fixtures";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
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
function renderTarget(nemuId: string) {
  const element = document.createElement("button");
  element.dataset.nemuId = nemuId;
  document.body.append(element);
  let box = new DOMRect(40, 300, 200, 32);
  element.getBoundingClientRect = () => box;
  const scrollIntoView = vi.fn();
  element.scrollIntoView = scrollIntoView;
  return {
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

    expect(target.scrollIntoView).toHaveBeenCalledOnce();
    await waitFor(() =>
      expect(result.current.highlights).toEqual([
        { action: notHotel, box: { left: 40, top: 300, width: 200, height: 32 } },
      ]),
    );
    expect(result.current.missing).toEqual([]);
  });

  test("stays attached when the page scrolls or the window resizes", async () => {
    const target = renderTarget(notHotel.target);
    const result = renderHighlights([notHotel]);
    await waitFor(() => expect(result.current.highlights).toHaveLength(1));

    target.moveTo(new DOMRect(40, 120, 200, 32));
    window.dispatchEvent(new Event("scroll"));
    await waitFor(() => expect(result.current.highlights[0]?.box.top).toBe(120));

    target.moveTo(new DOMRect(16, 120, 160, 32));
    window.dispatchEvent(new Event("resize"));
    await waitFor(() =>
      expect(result.current.highlights[0]?.box).toEqual({
        left: 16,
        top: 120,
        width: 160,
        height: 32,
      }),
    );
  });

  test("reports a target missing from the page instead of throwing", async () => {
    renderTarget(notHotel.target);

    const result = renderHighlights([notHotel, amount]);

    await waitFor(() => expect(result.current.highlights).toHaveLength(1));
    expect(result.current.missing).toEqual([amount]);
  });

  test("leaves click and confirm actions to their own runners", () => {
    renderTarget("menu-ajukan-perjalanan-dinas");

    const result = renderHighlights([
      {
        type: "click",
        target: "menu-ajukan-perjalanan-dinas",
        level: "jalan_sendiri",
        label: "Buka",
      },
    ]);

    expect(result.current).toEqual({ highlights: [], missing: [] });
  });
});
