import type { NemuAction, NemuGuide, PageElement } from "@nemu/contracts";
import { useEffect } from "react";

import { collectSettledElementList } from "../../element-list/lib/settled-element-list";
import { followsUpAfterClick } from "../lib/follow-up";

/**
 * After a click that opens a Task succeeds, waits for the new page to replace `leaving` (the
 * nemu_ids of the page clicked on) and load, and hands its Element List to `followUp`. Closing the
 * card or a new answer before then cancels it.
 */
export function useClickFollowUp(
  clicked: NemuAction | undefined,
  leaving: string,
  guide: NemuGuide | undefined,
  followUp: (elements: PageElement[]) => void,
) {
  useEffect(() => {
    if (!clicked || !followsUpAfterClick(clicked.target, guide)) return;

    const controller = new AbortController();
    void collectSettledElementList(controller.signal, { leaving }).then((elements) => {
      if (!controller.signal.aborted) followUp(elements);
    });
    return () => controller.abort();
  }, [clicked, leaving, followUp, guide]);
}
