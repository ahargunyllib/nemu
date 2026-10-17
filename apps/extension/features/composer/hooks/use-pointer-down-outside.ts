import { type RefObject, useEffect, useRef } from "react";

/**
 * Calls `onOutside` when a pointer goes down outside `boundary`, without stopping the page from
 * handling it. Reads the event's composed path, so a press inside Nemu's shadow root still counts
 * as inside, and listens in the capture phase, so a page that stops propagation can't hide it.
 */
export function usePointerDownOutside(
  boundary: RefObject<HTMLElement | null>,
  onOutside: () => void,
) {
  const latestOnOutside = useRef(onOutside);

  useEffect(() => {
    latestOnOutside.current = onOutside;
  });

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      const element = boundary.current;
      if (element && !event.composedPath().includes(element)) latestOnOutside.current();
    }

    window.addEventListener("pointerdown", onPointerDown, { capture: true });
    return () => window.removeEventListener("pointerdown", onPointerDown, { capture: true });
  }, [boundary]);
}
