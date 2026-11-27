import { useSyncExternalStore } from "react";

import { recorder } from "../stores/recorder";

/** What "Rekam cara" shows on the page now (#214). */
export function useRecorder() {
  return useSyncExternalStore(recorder.subscribe, recorder.getView);
}
