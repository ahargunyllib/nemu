import { useSyncExternalStore } from "react";

import { executor } from "../stores/executor";

/** What the executor shows on the page now (#202). */
export function useExecutor() {
  return useSyncExternalStore(executor.subscribe, executor.getView);
}
