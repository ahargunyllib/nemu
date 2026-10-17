import type { PageElement } from "@nemu/contracts";

import { collectElementList } from "./element-list";

/** How long the page's nemu_ids must stay the same to count as settled. */
export const SETTLE_MS = 300;
/** The longest the page gets to settle; after that, the Element List is taken as it is. */
export const SETTLE_TIMEOUT_MS = 3_000;
const POLL_MS = 50;

/**
 * Collects the Element List once a page a click opened has finished loading: no `Skeleton` is
 * showing and the same nemu_ids have been on the page for `SETTLE_MS`. A page still loading its
 * data would otherwise send a list without the elements the answer needs.
 */
export async function collectSettledElementList(
  signal: AbortSignal,
  root: Document = document,
): Promise<PageElement[]> {
  let last = "";
  let stableSince = Date.now();

  for (const startedAt = Date.now(); Date.now() - startedAt < SETTLE_TIMEOUT_MS;) {
    const ids = nemuIdsOf(root);
    if (ids !== last) {
      last = ids;
      stableSince = Date.now();
    } else if (!isLoading(root) && Date.now() - stableSince >= SETTLE_MS) {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
    if (signal.aborted) return [];
  }
  return collectElementList(root);
}

function nemuIdsOf(root: Document): string {
  return Array.from(root.querySelectorAll<HTMLElement>("[data-nemu-id]"), (element) => {
    return element.dataset.nemuId ?? "";
  }).join(" ");
}

/** The Demo App shows a shadcn `Skeleton` while a page's data loads. */
function isLoading(root: Document): boolean {
  return root.querySelector('[data-slot="skeleton"]') !== null;
}
