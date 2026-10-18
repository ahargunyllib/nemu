import type { NemuAction } from "@nemu/contracts";
import { useEffect, useState } from "react";

import type { Box } from "../../../shared/types/box";
import {
  completesStep,
  findHighlightTargets,
  type HighlightTarget,
  watchPick,
} from "../lib/highlight-targets";

export type TrackedHighlight = { action: NemuAction; box: Box };

type Targets = { found: HighlightTarget[]; missing: NemuAction[] };

const NO_TARGETS: Targets = { found: [], missing: [] };
const POLL_MS = 100;

export type HighlightOptions = {
  /**
   * How long to keep looking for targets that aren't on the page yet, such as on a page a click
   * just opened. Nothing is ringed until every target is found or the time is up.
   */
  waitMs?: number;
  /** How long a done step stays up, so the mascot can show success, before the next one starts. */
  doneMs?: number;
};

/**
 * Runs the `highlight` and `confirm` actions of an answer one step at a time: rings only the
 * current target, scrolls it into view, and follows its box each frame, so the ring stays attached
 * through scrolling, resizing, and layout shifts. Filling or pressing the target, or picking a
 * value in its popup, moves on to the next step, and doing the last one ends the guide, so its ring goes away; `goTo` moves between
 * steps by hand. Targets missing from the page come back in `missing` and are skipped.
 */
export function useHighlights(
  actions: readonly NemuAction[],
  { waitMs = 0, doneMs = 0 }: HighlightOptions = {},
) {
  const [targets, setTargets] = useState<Targets>(NO_TARGETS);
  const [searching, setSearching] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [done, setDone] = useState(false);
  const [highlight, setHighlight] = useState<TrackedHighlight>();

  useEffect(() => {
    setStepIndex(0);
    setDone(false);
    const first = findHighlightTargets(actions);
    if (waitMs <= 0 || first.missing.length === 0) {
      setTargets(first);
      setSearching(false);
      return;
    }

    setTargets(NO_TARGETS);
    setSearching(true);
    const startedAt = Date.now();
    const timer = setInterval(() => {
      const next = findHighlightTargets(actions);
      if (next.missing.length > 0 && Date.now() - startedAt < waitMs) return;
      clearInterval(timer);
      setTargets(next);
      setSearching(false);
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [actions, waitMs]);

  const { found } = targets;
  const current = found[stepIndex];

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
      const key = JSON.stringify(box);
      if (key !== lastBox) {
        lastBox = key;
        setHighlight(box && { action, box });
      }
      frame = requestAnimationFrame(track);
    }
    track();

    let doneTimer: ReturnType<typeof setTimeout> | undefined;
    let finished = false;
    function finish() {
      if (finished) return;
      finished = true;
      // Past the last step there is no current target, so the ring goes away.
      if (doneMs <= 0) {
        setStepIndex((index) => index + 1);
        return;
      }
      setDone(true);
      doneTimer = setTimeout(() => {
        setDone(false);
        setStepIndex((index) => index + 1);
      }, doneMs);
    }
    function advance(event: Event) {
      if (completesStep(event, element)) finish();
    }
    element.addEventListener("change", advance);
    element.addEventListener("click", advance);
    const stopWatching = watchPick(element, finish);

    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(doneTimer);
      setDone(false);
      stopWatching();
      element.removeEventListener("change", advance);
      element.removeEventListener("click", advance);
    };
  }, [current, doneMs]);

  return {
    /** The current step's ring, once its target is on the page. */
    highlight,
    /** The action of every target found, in the order the user takes them. */
    steps: found.map(({ action }) => action),
    stepIndex,
    /** Still looking for targets on a page that is loading. */
    searching,
    /** The user just did the current step; it stays up for `doneMs` before the next one. */
    done,
    goTo: (index: number) => setStepIndex(Math.max(0, Math.min(index, found.length - 1))),
    missing: targets.missing,
  };
}

function boxOf(element: HTMLElement): Box {
  const { left, top, width, height } = element.getBoundingClientRect();
  return { left, top, width, height };
}
