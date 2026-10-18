import type { NemuAction, PageElement } from "@nemu/contracts";
import { useMemo } from "react";

import { DONE_MS, isGuided } from "../../guided-steps/lib/guided-steps";
import { useHighlights } from "../../highlight/hooks/use-highlights";
import { useNavigationClick } from "../../navigation-click/hooks/use-navigation-click";
import type { Point } from "../../navigation-click/lib/navigation-click";
import { asHighlight, enforceActionLevels } from "../lib/enforce-action-levels";

const NO_ACTIONS: NemuAction[] = [];
/** How long a page a click opened gets to render the targets of the steps that follow. */
export const NEW_PAGE_WAIT_MS = 3_000;

/**
 * Runs an answer's actions on the page: applies the bundled Action Levels, makes the first
 * allowed click, and highlights the rest one step at a time. The highlights wait for the click:
 * once it opens a new page, their targets are looked up there. A click that is stopped, can't find
 * its target, or changes nothing falls back to a highlight on its target. An answer whose steps
 * carry a note runs as guided steps, where a done step shows success for a moment.
 *
 * `elementList` is the Element List sent with the prompt; only its targets can be clicked.
 */
export function useAnswerActions(
  actions: readonly NemuAction[],
  elementList: readonly PageElement[],
  start: Point | null,
) {
  const enforced = useMemo(() => enforceActionLevels(actions, elementList), [actions, elementList]);
  // One click per answer: a navigation click usually changes the page under the next one.
  const click = enforced.find((action) => action.type === "click");
  const navigation = useNavigationClick(click, start);
  const clickPending = Boolean(click) && navigation.outcome === null;
  const clickFailed = Boolean(navigation.outcome && navigation.outcome !== "succeeded");
  const guided = isGuided(actions);

  const highlightActions = useMemo(() => {
    if (clickPending) return NO_ACTIONS;
    return click && clickFailed ? [...enforced, asHighlight(click)] : enforced;
  }, [enforced, click, clickPending, clickFailed]);
  const highlights = useHighlights(highlightActions, {
    waitMs: navigation.outcome === "succeeded" ? NEW_PAGE_WAIT_MS : 0,
    doneMs: guided ? DONE_MS : 0,
  });

  const warnings =
    click && navigation.outcome === "no-change" ? [clickHadNoEffectWarning(click)] : [];

  return {
    ...highlights,
    /** Whether the answer runs as guided steps, with a step card instead of the Answer Card. */
    guided,
    /** Still waiting for the click, or for the page it opened, before the steps can start. */
    searching: clickPending || highlights.searching,
    warnings,
    cursor: navigation.cursor,
    outcome: navigation.outcome,
    /** The click once it has changed the page. */
    clicked: navigation.outcome === "succeeded" ? click : undefined,
  };
}

function clickHadNoEffectWarning(action: NemuAction): string {
  return `Nemu mengklik "${action.label}" tetapi halaman tidak berubah. Klik sendiri yang disorot.`;
}
