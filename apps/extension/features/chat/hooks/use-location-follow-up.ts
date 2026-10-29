import type { PageElement } from "@nemu/contracts";
import { useEffect } from "react";

import {
  collectSettledElementList,
  pageNemuIds,
} from "../../element-list/lib/settled-element-list";
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
    // What was on screen at `currentUrl`, so the follow-up waits until the new page replaces it.
    let currentIds = pageNemuIds();
    let collection: AbortController | undefined;
    const timer = window.setInterval(() => {
      if (window.location.href === currentUrl) {
        currentIds = pageNemuIds();
        return;
      }
      currentUrl = window.location.href;
      collection?.abort();
      collection = new AbortController();
      const { signal } = collection;
      void collectSettledElementList(signal, { leaving: currentIds }).then((elements) => {
        if (!signal.aborted) followUp(elements);
      });
    }, LOCATION_CHECK_MS);

    return () => {
      window.clearInterval(timer);
      collection?.abort();
    };
  }, [followUp, session]);
}
