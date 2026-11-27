// @vitest-environment happy-dom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";

import { useElementRect } from "./use-element-rect";

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

/** A menu item whose place the test moves, as Popper does, without any event. */
function menuItem() {
  const item = document.createElement("a");
  let top = 700;
  item.getBoundingClientRect = () =>
    ({
      left: 900,
      top,
      width: 200,
      height: 32,
      x: 900,
      y: top,
      right: 1100,
      bottom: top + 32,
    }) as DOMRect;
  document.body.append(item);
  return { item, moveTo: (next: number) => (top = next) };
}

test("a target that moves without an event is followed for a second after it shows", () => {
  const { item, moveTo } = menuItem();
  const { result } = renderHook(() => useElementRect(item));
  expect(result.current?.top).toBe(700);
  moveTo(668);
  act(() => vi.advanceTimersByTime(100));
  expect(result.current?.top).toBe(668);
});

test("after a scroll it is followed again until it settles", () => {
  const { item, moveTo } = menuItem();
  const { result } = renderHook(() => useElementRect(item));
  act(() => vi.advanceTimersByTime(2000));
  moveTo(400);
  act(() => vi.advanceTimersByTime(100));
  // Settled and nothing happened: the old place stands until the page says it moved.
  expect(result.current?.top).toBe(700);
  act(() => {
    window.dispatchEvent(new Event("scroll"));
    vi.advanceTimersByTime(100);
  });
  expect(result.current?.top).toBe(400);
});
