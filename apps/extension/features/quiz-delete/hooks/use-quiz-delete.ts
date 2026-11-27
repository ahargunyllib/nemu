import { useSyncExternalStore } from "react";

import { quizDelete } from "../stores/quiz-delete";

/** What F4-06 shows on the page now (#211). */
export function useQuizDelete() {
  return useSyncExternalStore(quizDelete.subscribe, quizDelete.getView);
}
