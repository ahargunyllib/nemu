import { useSyncExternalStore } from "react";

import { processRun } from "../stores/process-run";

/** What the F3 flow shows on the page now (#213). */
export function useProcessRun() {
  return useSyncExternalStore(processRun.subscribe, processRun.getView);
}
