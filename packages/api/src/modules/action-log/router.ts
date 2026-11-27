import { actionLogRecordInputSchema } from "@nemu/contracts/executor";
import { z } from "zod";

import { schoolProcedure } from "../../index";
import { insertActionLog } from "./repository";

export const actionLogRouter = {
  /**
   * WS-10: the executor reports what Nemu did on a page (#202), as the teacher on the page. The
   * entries name targets, never values, so no grade is stored.
   */
  actionLogRecord: schoolProcedure
    .input(actionLogRecordInputSchema)
    .output(z.object({ recorded: z.number().int() }))
    .handler(async ({ context, input }) => {
      const teacher = await context.caller.requireTeacher();
      await insertActionLog(
        context.db,
        {
          workspaceId: context.caller.workspaceId,
          teacherId: teacher.teacherId,
          teacherName: teacher.name,
        },
        input.entries,
      );
      return { recorded: input.entries.length };
    }),
};
