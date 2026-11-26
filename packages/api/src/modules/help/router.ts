import { screenSnapshotSchema } from "@nemu/contracts/school";
import { z } from "zod";

import type { Context } from "../../context";
import { schoolProcedure } from "../../index";
import { createDocumentRepository } from "../documents/repository";
import { ask, explain, route } from "./service";

function helpDeps(context: Pick<Context, "db" | "school" | "documentFiles">) {
  return { ai: context.school.ai, documents: createDocumentRepository(context.db) };
}

export const helpRouter = {
  /** F2: the screen-reader's snapshot (+ what the teacher said) → whose fault, who fixes it, WhatsApp draft. */
  helpExplain: schoolProcedure
    .input(
      z.object({ snapshot: screenSnapshotSchema, question: z.string().trim().max(500).nullable() }),
    )
    .handler(async ({ context, input }) => {
      const teacher = await context.caller.requireTeacher();
      return explain(helpDeps(context), teacher, context.caller.workspaceId, input);
    }),

  /** F3-04/F3-07: a question answered only from active school knowledge, with verified citations. */
  helpAsk: schoolProcedure
    .input(z.object({ question: z.string().trim().min(1).max(500) }))
    .handler(async ({ context, input }) => {
      await context.caller.requireTeacher();
      return ask(helpDeps(context), context.caller.workspaceId, input.question);
    }),

  /** Routes a transcript to a feature; voice controls are recognized without a model call. */
  helpRoute: schoolProcedure
    .input(z.object({ utterance: z.string().trim().min(1).max(500) }))
    .handler(({ context, input }) =>
      route(helpDeps(context), context.caller.workspaceId, input.utterance),
    ),
};
