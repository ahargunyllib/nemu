import { screenSnapshotSchema } from "@nemu/contracts/school";
import { z } from "zod";

import type { AuthenticatedContext } from "../../context";
import { schoolProcedure } from "../../index";
import { createDocumentRepository } from "../documents/repository";
import { requireTeacher } from "../school/teacher";
import { ask, explain, route } from "./service";

function helpDeps(context: AuthenticatedContext) {
  return { ai: context.school.ai, documents: createDocumentRepository(context.db) };
}

export const helpRouter = {
  /** F2: the extension's page snapshot (+ what the teacher said) → whose fault, who fixes it, WhatsApp draft. */
  helpExplain: schoolProcedure
    .input(
      z.object({ snapshot: screenSnapshotSchema, question: z.string().trim().max(500).nullable() }),
    )
    .handler(async ({ context, input }) => {
      const teacher = await requireTeacher(context.school.directory, context.session.user.id);
      return explain(helpDeps(context), teacher, context.session.user.workspaceId, input);
    }),

  /** F3-04/F3-07: a question answered only from active school knowledge, with verified citations. */
  helpAsk: schoolProcedure
    .input(z.object({ question: z.string().trim().min(1).max(500) }))
    .handler(async ({ context, input }) => {
      await requireTeacher(context.school.directory, context.session.user.id);
      return ask(helpDeps(context), context.session.user.workspaceId, input.question);
    }),

  /** Routes a transcript to a feature; voice controls are recognized without a model call. */
  helpRoute: schoolProcedure
    .input(z.object({ utterance: z.string().trim().min(1).max(500) }))
    .handler(({ context, input }) =>
      route(helpDeps(context), context.session.user.workspaceId, input.utterance),
    ),
};
