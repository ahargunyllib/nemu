/** "Pertanyaan guru": how many questions teachers asked Nemu this week, and how many it couldn't answer. */
export type TeacherQuestionStats = { asked: number; unanswered: number };

/**
 * The teacher-question count for Dokumen dan alur's stat card. The Nemu Service keeps no question
 * log yet, so this returns null and the card shows "—"; read the count procedure here once it lands.
 */
export function useTeacherQuestionStats(): TeacherQuestionStats | null {
  return null;
}
