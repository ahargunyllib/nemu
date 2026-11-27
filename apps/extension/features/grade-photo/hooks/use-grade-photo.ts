import { useSyncExternalStore } from "react";

import { gradePhoto } from "../stores/grade-photo";

/** What the F1 flow shows on the page now (#207). */
export function useGradePhoto() {
  return useSyncExternalStore(gradePhoto.subscribe, gradePhoto.getView);
}
