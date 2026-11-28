/** "Pertanyaan guru": this week's teacher questions, and the ones Nemu couldn't answer. */
export type TeacherQuestionStats = { askedThisWeek: number; unansweredThisWeek: number };

/**
 * The teacher-question count for Dokumen dan alur's stat card. The count procedure
 * (`teacherQuestionStats`) is not on `main` yet, so `data` stays undefined and the card shows "—".
 * Once it lands, replace this with `features/teacher-questions/hooks/use-teacher-question-stats`,
 * which returns the same shape.
 */
export function useTeacherQuestionStats(): { data: TeacherQuestionStats | undefined } {
  return { data: undefined };
}
