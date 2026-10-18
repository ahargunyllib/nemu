import type { NemuAction, PageElement } from "@nemu/contracts";
import { useMemo } from "react";

import { useHighlights } from "../../highlight/hooks/use-highlights";
import { useNavigationClick } from "../../navigation-click/hooks/use-navigation-click";
import type { Point } from "../../navigation-click/lib/navigation-click";
import { asHighlight, enforceActionLevels } from "../lib/enforce-action-levels";

/**
 * Runs an answer's actions on the page: applies the bundled Action Levels, makes the first
 * allowed click, and highlights the rest one step at a time. A click that is stopped, can't find its target, or
 * changes nothing falls back to a highlight on its target.
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
  const navigation = useNavigationClick(click, start, elementList);
  const clickFailed = Boolean(navigation.outcome && navigation.outcome !== "succeeded");

  const highlightActions = useMemo(
    () => (click && clickFailed ? [...enforced, asHighlight(click)] : enforced),
    [enforced, click, clickFailed],
  );
  const highlights = useHighlights(highlightActions);

  const warnings =
    click && navigation.outcome === "no-change" ? [clickHadNoEffectWarning(click)] : [];

  return {
    ...highlights,
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
