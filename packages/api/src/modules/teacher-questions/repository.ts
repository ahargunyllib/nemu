import { and, count, type Database, eq, gte } from "@nemu/db";
import { teacherQuestion } from "@nemu/db/schema/teacher-question";

/** One teacher question as counted (ADR-0022): never its words, never the answer. */
export type TeacherQuestionEntry = {
  workspaceId: string;
  teacherId: string;
  kind: (typeof teacherQuestion.$inferInsert)["kind"];
  answered: boolean;
  askedAt: Date;
};

export type TeacherQuestionCounts = { asked: number; unanswered: number };

/** "Pertanyaan guru" storage: one row per question, counted by school and week. */
export type TeacherQuestionRepository = {
  record(entry: TeacherQuestionEntry): Promise<void>;
  countSince(workspaceId: string, since: Date): Promise<TeacherQuestionCounts>;
};

export function createTeacherQuestionRepository(db: Database): TeacherQuestionRepository {
  return {
    async record(entry) {
      await db.insert(teacherQuestion).values({ id: crypto.randomUUID(), ...entry });
    },
    async countSince(workspaceId, since) {
      const rows = await db
        .select({ answered: teacherQuestion.answered, total: count() })
        .from(teacherQuestion)
        .where(
          and(eq(teacherQuestion.workspaceId, workspaceId), gte(teacherQuestion.askedAt, since)),
        )
        .groupBy(teacherQuestion.answered);
      const asked = rows.reduce((sum, row) => sum + row.total, 0);
      const unanswered = rows.find((row) => !row.answered)?.total ?? 0;
      return { asked, unanswered };
    },
  };
}
