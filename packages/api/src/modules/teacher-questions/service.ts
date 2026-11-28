import type { TeacherQuestionRepository } from "./repository";

/** The school's clock: Western Indonesian Time (WIB), UTC+7 all year. */
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

/** Monday 00.00 WIB of the week `now` falls in: where "pekan ini" starts. */
export function startOfSchoolWeek(now: Date): Date {
  const local = new Date(now.getTime() + WIB_OFFSET_MS);
  const daysSinceMonday = (local.getUTCDay() + 6) % 7;
  const monday = Date.UTC(
    local.getUTCFullYear(),
    local.getUTCMonth(),
    local.getUTCDate() - daysSinceMonday,
  );
  return new Date(monday - WIB_OFFSET_MS);
}

export type TeacherQuestionStats = { askedThisWeek: number; unansweredThisWeek: number };

/** "Pertanyaan guru 47 · pekan ini · 3 belum terjawab", and the Uji jawaban badge. */
export async function teacherQuestionStats(
  questions: Pick<TeacherQuestionRepository, "countSince">,
  workspaceId: string,
  now: Date,
): Promise<TeacherQuestionStats> {
  const { asked, unanswered } = await questions.countSince(workspaceId, startOfSchoolWeek(now));
  return { askedThisWeek: asked, unansweredThisWeek: unanswered };
}
