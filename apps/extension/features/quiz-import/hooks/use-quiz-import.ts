import { useSyncExternalStore } from "react";

import { quizImport } from "../stores/quiz-import";

/** What F4-03 shows on the page now (#210). */
export function useQuizImport() {
  return useSyncExternalStore(quizImport.subscribe, quizImport.getView);
}
