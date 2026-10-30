import type { NemuAction, PageElement } from "@nemu/contracts";
import { useEffect, useRef, useState } from "react";

import { pageNemuIds } from "../../element-list/lib/settled-element-list";
import {
  clickDestination,
  type ClickOutcome,
  type CursorFrame,
  type Point,
  runNavigationClick,
} from "../lib/navigation-click";

/** How long the mascot shows success or warning before it rests again (#6). */
export const RESTING_MS = 3_000;

type NavigationClickState = {
  cursor: CursorFrame | null;
  outcome: ClickOutcome | null;
  /** The nemu_ids (`pageNemuIds`) of the page the click was made on. */
  leaving: string;
};

const IDLE: NavigationClickState = { cursor: null, outcome: null, leaving: "" };

/**
 * Runs one `click` action, already cleared by the Action Levels, starting the cursor at `start`.
 * Esc stops it before the click lands. A new action, or none, cancels the running one.
 * `elementList` names what the click opens.
 */
export function useNavigationClick(
  action: NemuAction | undefined,
  start: Point | null,
  elementList: readonly PageElement[],
): NavigationClickState {
  const [state, setState] = useState<NavigationClickState>(IDLE);
  const startRef = useRef(start);
  const elementListRef = useRef(elementList);

  // Only a new action starts a click; a moved start point (the Composer reopened) doesn't.
  useEffect(() => {
    startRef.current = start;
    elementListRef.current = elementList;
  });

  useEffect(() => {
    setState(IDLE);
    if (!action) return;

    const controller = new AbortController();
    let disposed = false;
    let restTimer: ReturnType<typeof setTimeout> | undefined;
    const destination = clickDestination(action, elementListRef.current);
    const leaving = pageNemuIds();

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
      onFrame: (frame) => {
        if (disposed) return;
        const cursor = frame.mascot === "clicking" ? { ...frame, destination } : frame;
        setState({ cursor, outcome: null, leaving });
      },
    }).then((outcome) => {
      window.removeEventListener("keydown", stopOnEscape, { capture: true });
      if (disposed) return;
      if (outcome === "stopped") {
        setState({ cursor: null, outcome, leaving });
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
