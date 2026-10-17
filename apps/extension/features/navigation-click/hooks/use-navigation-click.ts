import type { NemuAction } from "@nemu/contracts";
import { useEffect, useRef, useState } from "react";

import {
  type ClickOutcome,
  type CursorFrame,
  type Point,
  runNavigationClick,
} from "../lib/navigation-click";

/** How long the mascot shows success or warning before it rests again (#6). */
export const RESTING_MS = 3_000;

type NavigationClickState = { cursor: CursorFrame | null; outcome: ClickOutcome | null };

const IDLE: NavigationClickState = { cursor: null, outcome: null };

/**
 * Runs one `click` action, already cleared by the Action Levels, starting the cursor at `start`.
 * Esc stops it before the click lands. A new action, or none, cancels the running one.
 */
export function useNavigationClick(
  action: NemuAction | undefined,
  start: Point | null,
): NavigationClickState {
  const [state, setState] = useState<NavigationClickState>(IDLE);
  const startRef = useRef(start);

  // Only a new action starts a click; a moved start point (the Composer reopened) doesn't.
  useEffect(() => {
    startRef.current = start;
  });

  useEffect(() => {
    setState(IDLE);
    if (!action) return;

    const controller = new AbortController();
    let disposed = false;
    let restTimer: ReturnType<typeof setTimeout> | undefined;

    function stopOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") controller.abort();
    }
    // Capture, so Esc works wherever focus is, including inside the overlay's shadow root.
    window.addEventListener("keydown", stopOnEscape, { capture: true });

    void runNavigationClick({
      target: action.target,
      from: startRef.current ?? { x: window.innerWidth / 2, y: window.innerHeight / 3 },
      signal: controller.signal,
      reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      onFrame: (cursor) => {
        if (!disposed) setState({ cursor, outcome: null });
      },
    }).then((outcome) => {
      window.removeEventListener("keydown", stopOnEscape, { capture: true });
      if (disposed) return;
      if (outcome === "stopped") {
        setState({ cursor: null, outcome });
        return;
      }
      setState((current) => ({ ...current, outcome }));
      restTimer = setTimeout(
        () => setState((current) => ({ ...current, cursor: null })),
        RESTING_MS,
      );
    });

    return () => {
      disposed = true;
      controller.abort();
      clearTimeout(restTimer);
      window.removeEventListener("keydown", stopOnEscape, { capture: true });
    };
  }, [action]);

  return state;
}
