import { orpc } from "@/shared/api/orpc";

/** This week's teacher questions and the unanswered ones (ADR-0022), for the menu and the stat card. */
export function teacherQuestionStatsQueryOptions() {
  return orpc.teacherQuestionStats.queryOptions();
}
