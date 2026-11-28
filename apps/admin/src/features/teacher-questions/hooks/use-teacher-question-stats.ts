import { useQuery } from "@tanstack/react-query";

import { teacherQuestionStatsQueryOptions } from "@/features/teacher-questions/api/teacher-question-stats";

/** `data`: `{ askedThisWeek, unansweredThisWeek }`, counted from Monday 00.00 WIB. */
export function useTeacherQuestionStats() {
  return useQuery(teacherQuestionStatsQueryOptions());
}
