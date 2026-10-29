// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vite-plus/test";

import type { Box } from "../../../shared/types/box";
import { RESTING_MS } from "../../navigation-click/hooks/use-navigation-click";
import type { Point } from "../lib/mascot-position";
import type { MascotActivity } from "../lib/mascot-state";
import { Mascot } from "./mascot";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const NOTHING: MascotActivity = {
  listening: false,
  thinking: false,
  clicking: false,
  guiding: false,
  succeeded: false,
  failed: false,
};

function renderMascot() {
  const onOpenComposer = vi.fn();
  const view = render(
    <Mascot
      activity={NOTHING}
      composerAnchor={null}
      nemuCursor={null}
      onOpenComposer={onOpenComposer}
    />,
  );
  function rerender(
    activity: Partial<MascotActivity>,
    composerAnchor: Point | null = null,
    draggedArea: Box | null = null,
  ) {
    view.rerender(
      <Mascot
        activity={{ ...NOTHING, ...activity }}
        composerAnchor={composerAnchor}
        nemuCursor={null}
        draggedArea={draggedArea}
        onOpenComposer={onOpenComposer}
      />,
    );
  }
  return { onOpenComposer, rerender };
}

function moveCursor(x: number, y: number) {
  fireEvent.mouseMove(window, { clientX: x, clientY: y });
}

function mascot() {
  return document.querySelector<HTMLElement>("[data-mascot-state]");
}

describe("Mascot", () => {
  test("appears 12 px below and to the right of the cursor once it moves", () => {
    renderMascot();
    expect(mascot()).toBeNull();

    moveCursor(400, 300);

    expect(mascot()?.style.transform).toBe("translate(412px, 312px)");
    expect(mascot()?.dataset.mascotState).toBe("idle");
  });

  test("opens the Composer where it is clicked", () => {
    const { onOpenComposer } = renderMascot();
    moveCursor(400, 300);

    fireEvent.click(screen.getByRole("button", { name: "Tanya Nemu" }), {
      clientX: 420,
      clientY: 320,
    });

    expect(onOpenComposer).toHaveBeenCalledExactlyOnceWith({ x: 420, y: 320 });
  });

  test("stops following the cursor while the Composer is open", () => {
    const { rerender } = renderMascot();
    moveCursor(400, 300);
    rerender({ listening: true }, { x: 400, y: 300 });
    const waiting = mascot()?.style.transform;

    moveCursor(900, 600);
    expect(mascot()?.style.transform).toBe(waiting);
    expect(mascot()?.dataset.mascotState).toBe("listening");

    rerender({});
    expect(mascot()?.style.transform).toBe("translate(912px, 612px)");
  });

  test("sits as the cursor at the bottom-right corner of a Blok area while it is dragged", () => {
    const { rerender } = renderMascot();
    moveCursor(400, 300);
    const anchor = { x: 400, y: 300 };
    rerender({ listening: true }, anchor);
    const waiting = mascot()?.style.transform;

    rerender({ listening: true }, anchor, { left: 40, top: 300, width: 520, height: 140 });
    expect(mascot()?.style.transform).toBe("translate(572px, 452px)");

    rerender({ listening: true }, anchor);
    expect(mascot()?.style.transform).toBe(waiting);
  });

  test("has no button but the mascot itself", () => {
    renderMascot();
    moveCursor(400, 300);

    expect(
      screen.getAllByRole("button").map((button) => button.getAttribute("aria-label")),
    ).toEqual(["Tanya Nemu"]);
  });

  test("returns to idle 3 seconds after success", () => {
    vi.useFakeTimers();
    const { rerender } = renderMascot();
    moveCursor(400, 300);

    rerender({ clicking: true });
    expect(mascot()?.dataset.mascotState).toBe("clicking");
    rerender({ succeeded: true });
    expect(mascot()?.dataset.mascotState).toBe("success");

    act(() => vi.advanceTimersByTime(RESTING_MS - 1));
    expect(mascot()?.dataset.mascotState).toBe("success");
    act(() => vi.advanceTimersByTime(1));
    expect(mascot()?.dataset.mascotState).toBe("idle");
  });

  test("Esc returns it to idle until the Composer opens again", () => {
    const { rerender } = renderMascot();
    moveCursor(400, 300);
    rerender({ guiding: true });
    expect(mascot()?.dataset.mascotState).toBe("guiding");

    fireEvent.keyDown(window, { key: "Escape" });
    expect(mascot()?.dataset.mascotState).toBe("idle");
    rerender({ guiding: true, failed: true });
    expect(mascot()?.dataset.mascotState).toBe("idle");

    rerender({ listening: true }, { x: 400, y: 300 });
    expect(mascot()?.dataset.mascotState).toBe("listening");
    rerender({ thinking: true });
    expect(mascot()?.dataset.mascotState).toBe("thinking");
  });
});
