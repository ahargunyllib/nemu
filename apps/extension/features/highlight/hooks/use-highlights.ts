import type { NemuAction } from "@nemu/contracts";
import { useEffect, useState } from "react";

import type { Box } from "../../../shared/types/box";
import {
  completesStep,
  findHighlightTargets,
  type HighlightStep,
  type HighlightTarget,
  opensPopup,
} from "../lib/highlight-targets";

/** The current step's target box, and the next step's while it is on the page. */
export type TrackedHighlight = { action: NemuAction; box: Box; next?: Box };

type Targets = { found: HighlightTarget[]; missing: NemuAction[] };

const NO_TARGETS: Targets = { found: [], missing: [] };

/**
 * Runs the `highlight` and `confirm` actions of an answer one step at a time: rings only the
 * current target, scrolls it into view, and follows its box each frame, so the ring stays attached
 * through scrolling, resizing, and layout shifts. Filling or pressing the target, or picking a
 * value in the popup it opens, moves on to the next step, and doing the last one ends the guide, so its ring goes away. Targets missing from
 * the page come back in `missing` and are skipped.
 */
export function useHighlights(actions: readonly NemuAction[]) {
  const [targets, setTargets] = useState<Targets>(NO_TARGETS);
  const [stepIndex, setStepIndex] = useState(0);
  const [highlight, setHighlight] = useState<TrackedHighlight>();

  useEffect(() => {
    setTargets(findHighlightTargets(actions));
    setStepIndex(0);
  }, [actions]);

  const { found } = targets;
  const current = found[stepIndex];
  // The field still to fill after this one, which the Answer Card keeps off too.
  const nextElement = found[stepIndex + 1]?.element;

  useEffect(() => {
    if (!current) {
      setHighlight(undefined);
      return;
    }
    const { action, element } = current;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    element.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "center" });

    let frame = 0;
    let lastBox: string | undefined;
    function track() {
      const box = element.isConnected ? boxOf(element) : undefined;
      const next = nextElement?.isConnected ? boxOf(nextElement) : undefined;
      const key = JSON.stringify([box, next]);
      if (key !== lastBox) {
        lastBox = key;
        setHighlight(box && { action, box, next });
      }
      frame = requestAnimationFrame(track);
    }
    track();

    let done = false;
    function next() {
      if (done) return;
      done = true;
      // Past the last step there is no current target, so the ring goes away.
      setStepIndex((index) => index + 1);
    }
    function advance(event: Event) {
      if (completesStep(event, element)) next();
    }
    element.addEventListener("change", advance);
    element.addEventListener("click", advance);

    // A select or date picker takes its value in its popup: the step is done once the target
    // shows a different value than when its ring appeared.
    const shownValue = element.textContent;
    const valueWatch = new MutationObserver(() => {
      if (element.textContent !== shownValue) next();
    });
    if (opensPopup(element)) {
      valueWatch.observe(element, { characterData: true, childList: true, subtree: true });
    }

    return () => {
      cancelAnimationFrame(frame);
      element.removeEventListener("change", advance);
      element.removeEventListener("click", advance);
      valueWatch.disconnect();
    };
  }, [current, nextElement]);

  return {
    /** The current step's ring, once its target is on the page. */
    highlight,
    /** Every target found, in the order the user takes them, with its position among all steps. */
    steps: found.map(({ action, position }): HighlightStep => ({ action, position })),
    stepIndex,
    missing: targets.missing,
  };
}

function boxOf(element: HTMLElement): Box {
  const { left, top, width, height } = element.getBoundingClientRect();
  return { left, top, width, height };
}
