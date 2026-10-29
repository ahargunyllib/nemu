// @vitest-environment happy-dom
import type { NemuAction } from "@nemu/contracts";
import { momentOneResponse } from "@nemu/contracts/fixtures";
import { afterEach, beforeEach, describe, expect, test, vi } from "vite-plus/test";

import {
  CHECK_TIMEOUT_MS,
  type CursorFrame,
  MAX_MOVE_MS,
  MIN_MOVE_MS,
  MORPH_MS,
  moveDuration,
  runNavigationClick,
} from "./navigation-click";

function momentOneClick(): NemuAction {
  const [action] = momentOneResponse.actions;
  if (!action) throw new Error("The Momen 1 fixture has no click");
  return action;
}

const menuClick = momentOneClick();
const FROM = { x: 900, y: 500 };

beforeEach(() => {
  vi.useFakeTimers();
  window.history.replaceState(null, "", "/");
});

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = "";
});

/** The Beranda menu link; `onClick` stands in for what the Demo App does when it's clicked. */
function renderMenu(onClick: () => void = () => {}) {
  const link = document.createElement("a");
  link.dataset.nemuId = menuClick.target;
  link.getBoundingClientRect = () => new DOMRect(16, 120, 200, 40);
  link.scrollIntoView = vi.fn();
  const clicked = vi.fn(onClick);
  link.addEventListener("click", clicked);
  document.body.append(link);
  return { clicked };
}

function startClick() {
  const frames: CursorFrame[] = [];
  const controller = new AbortController();
  const outcome = runNavigationClick({
    target: menuClick.target,
    from: FROM,
    signal: controller.signal,
    onFrame: (frame) => frames.push(frame),
  });
  return { frames, outcome, stop: () => controller.abort() };
}

describe("runNavigationClick", () => {
  test("morphs, moves to the target, clicks it, and succeeds when the URL changes", async () => {
    const menu = renderMenu(() => window.history.pushState(null, "", "/perdin/baru"));
    const run = startClick();

    expect(run.frames).toEqual([{ mascot: "clicking", step: "morph", at: FROM, moveMs: 0 }]);
    await vi.advanceTimersByTimeAsync(MORPH_MS);
    const move = run.frames.at(-1);
    expect(move).toMatchObject({ step: "move", at: { x: 116, y: 140 } });
    const moveMs = move?.mascot === "clicking" ? move.moveMs : 0;
    expect(moveMs).toBeGreaterThanOrEqual(MIN_MOVE_MS);
    expect(moveMs).toBeLessThanOrEqual(MAX_MOVE_MS);
    expect(menu.clicked).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(moveMs);
    expect(menu.clicked).toHaveBeenCalledOnce();

    await expect(run.outcome).resolves.toBe("succeeded");
    expect(run.frames.at(-1)).toEqual({ mascot: "success", at: { x: 116, y: 140 } });
  });

  test("succeeds when the click opens a new element instead of a new page", async () => {
    renderMenu(() => {
      const dialog = document.createElement("div");
      dialog.dataset.nemuId = "dialog-baru";
      document.body.append(dialog);
    });
    const run = startClick();

    await vi.advanceTimersByTimeAsync(MORPH_MS + MAX_MOVE_MS);

    await expect(run.outcome).resolves.toBe("succeeded");
  });

  test("succeeds when a completed in-page step removes its target", async () => {
    renderMenu(() => document.querySelector(`[data-nemu-id="${menuClick.target}"]`)?.remove());
    const run = startClick();

    await vi.advanceTimersByTimeAsync(MORPH_MS + MAX_MOVE_MS);

    await expect(run.outcome).resolves.toBe("succeeded");
  });

  test("Esc before the click lands stops it without clicking", async () => {
    const menu = renderMenu();
    const run = startClick();

    await vi.advanceTimersByTimeAsync(MORPH_MS);
    run.stop();
    await vi.advanceTimersByTimeAsync(MAX_MOVE_MS + CHECK_TIMEOUT_MS);

    await expect(run.outcome).resolves.toBe("stopped");
    expect(menu.clicked).not.toHaveBeenCalled();
  });

  test("warns when the target isn't on the page", async () => {
    const run = startClick();

    await expect(run.outcome).resolves.toBe("missing");
    expect(run.frames).toEqual([{ mascot: "warning", at: FROM }]);
  });

  test("warns when the click changes nothing", async () => {
    const menu = renderMenu();
    const run = startClick();

    await vi.advanceTimersByTimeAsync(MORPH_MS + MAX_MOVE_MS + CHECK_TIMEOUT_MS + 100);

    await expect(run.outcome).resolves.toBe("no-change");
    expect(menu.clicked).toHaveBeenCalledOnce();
    expect(run.frames.at(-1)?.mascot).toBe("warning");
  });
});

describe("moveDuration", () => {
  test("stays within 400–800 ms however near or far the target is", () => {
    expect(moveDuration({ x: 0, y: 0 }, { x: 0, y: 0 })).toBe(MIN_MOVE_MS);
    expect(moveDuration({ x: 0, y: 0 }, { x: 4_000, y: 3_000 })).toBe(MAX_MOVE_MS);
  });
});
