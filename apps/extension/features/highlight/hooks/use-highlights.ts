import type { NemuAction } from "@nemu/contracts";
import { useEffect, useState } from "react";

import type { Box } from "../../../shared/types/box";
import { findHighlightTargets } from "../lib/highlight-targets";

export type TrackedHighlight = { action: NemuAction; box: Box };

type HighlightState = { highlights: TrackedHighlight[]; missing: NemuAction[] };

const EMPTY: HighlightState = { highlights: [], missing: [] };

/**
 * Runs the `highlight` actions of an answer: scrolls the first target into view, then follows
 * every target's box each frame, so the highlights stay attached through scrolling, resizing, and
 * layout shifts. Targets missing from the page come back in `missing`.
 */
export function useHighlights(actions: readonly NemuAction[]): HighlightState {
  const [state, setState] = useState<HighlightState>(EMPTY);

  useEffect(() => {
    const { found, missing } = findHighlightTargets(actions);
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    found[0]?.element.scrollIntoView({
      behavior: reducedMotion ? "auto" : "smooth",
      block: "center",
    });

    let frame = 0;
    let lastBoxes: string | undefined;
    function track() {
      const highlights = found
        .filter(({ element }) => element.isConnected)
        .map(({ action, element }) => {
          const { left, top, width, height } = element.getBoundingClientRect();
          return { action, box: { left, top, width, height } };
        });
      const boxes = JSON.stringify(highlights.map(({ box }) => box));
      if (boxes !== lastBoxes) {
        lastBoxes = boxes;
        setState({ highlights, missing });
      }
      if (found.length) frame = requestAnimationFrame(track);
    }
    track();

    return () => cancelAnimationFrame(frame);
  }, [actions]);

  return state;
}
