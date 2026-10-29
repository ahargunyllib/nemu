import type { PageElement } from "@nemu/contracts";
import { useEffect } from "react";

import { collectSettledElementList } from "../../element-list/lib/settled-element-list";
import type { GuideSession } from "../../guide/lib/guide-session";

const LOCATION_CHECK_MS = 100;

/** Continues an active guide when the user or the host SPA changes the page manually. */
export function useLocationFollowUp(
  session: GuideSession | null,
  followUp: (elements: PageElement[]) => void,
) {
  useEffect(() => {
    if (!session || session.currentStep >= session.steps.length) return;

    let currentUrl = window.location.href;
    let collection: AbortController | undefined;
    const timer = window.setInterval(() => {
      if (window.location.href === currentUrl) return;
      currentUrl = window.location.href;
      collection?.abort();
      collection = new AbortController();
      const { signal } = collection;
      void collectSettledElementList(signal).then((elements) => {
        if (!signal.aborted) followUp(elements);
      });
    }, LOCATION_CHECK_MS);

    return () => {
      window.clearInterval(timer);
      collection?.abort();
    };
  }, [followUp, session]);
}
