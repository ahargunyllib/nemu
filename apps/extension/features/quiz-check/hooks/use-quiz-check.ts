import { useSyncExternalStore } from "react";

import { quizCheck } from "../stores/quiz-check";

/** What F4-01 shows on the page now (#209). */
export function useQuizCheck() {
  return useSyncExternalStore(quizCheck.subscribe, quizCheck.getView);
}
