import { useLayoutEffect, useState } from "react";

import type { Rect } from "@nemu/ui/lib/nemu-placement";

function sameRect(a: Rect | null, b: Rect): boolean {
  return (
    a !== null &&
    a.left === b.left &&
    a.top === b.top &&
    a.width === b.width &&
    a.height === b.height
  );
}

/** How long the place is re-read every frame after it may have moved (a menu, a smooth scroll). */
const SETTLE_MS = 1000;

/**
 * An element's place in the viewport, kept current while the page scrolls or resizes. Some moves
 * fire no event: a dropdown placed by Popper a frame after the page scrolled, a menu sliding open.
 * So for a second after it shows, and after each scroll or resize, it is re-read every frame.
 */
export function useElementRect(element: Element | null): Rect | null {
  const [rect, setRect] = useState<Rect | null>(null);

  useLayoutEffect(() => {
    if (!element) {
      setRect(null);
      return;
    }
    let frame = 0;
    let until = 0;
    const read = () => {
      const { left, top, width, height } = element.getBoundingClientRect();
      const next = { left, top, width, height };
      setRect((current) => (sameRect(current, next) ? current : next));
    };
    const loop = () => {
      read();
      if (performance.now() < until) frame = requestAnimationFrame(loop);
    };
    const schedule = () => {
      until = performance.now() + SETTLE_MS;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(loop);
    };
    read();
    schedule();
    window.addEventListener("scroll", schedule, { capture: true, passive: true });
    window.addEventListener("resize", schedule);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule);
    observer?.observe(element);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule, { capture: true });
      window.removeEventListener("resize", schedule);
      observer?.disconnect();
    };
  }, [element]);

  return rect;
}
