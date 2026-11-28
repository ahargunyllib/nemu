import { z } from "zod";

import { schoolAdminProcedure } from "../../index";
import { createTeacherQuestionRepository } from "./repository";
import { teacherQuestionStats } from "./service";

export const teacherQuestionsRouter = {
  /**
   * The operator's or Admin Javan's count of this week's teacher questions, and how many Nemu
   * answered "belum ada di panduan" (ADR-0022).
   */
  teacherQuestionStats: schoolAdminProcedure
    .output(
      z.object({
        askedThisWeek: z.number().int(),
        unansweredThisWeek: z.number().int(),
      }),
    )
    .handler(({ context }) =>
      teacherQuestionStats(
        createTeacherQuestionRepository(context.db),
        context.session.user.workspaceId,
        new Date(),
      ),
    ),
};
