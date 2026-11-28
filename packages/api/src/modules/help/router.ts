import { pageSnapshotSchema } from "@nemu/contracts/school";
import { z } from "zod";

import type { Context } from "../../context";
import { schoolAdminProcedure, schoolProcedure } from "../../index";
import { createCatalogRepository } from "../documents/catalog-repository";
import { createDocumentRepository } from "../documents/repository";
import { createKamusRepository } from "../kamus/repository";
import { createTeacherQuestionRepository } from "../teacher-questions/repository";
import { askTeacher, explain, route, tryAnswer } from "./service";

function helpDeps(context: Pick<Context, "db" | "school">) {
  return {
    ai: context.school.ai,
    documents: createDocumentRepository(context.db),
    kamus: createKamusRepository(context.db),
  };
}

export const helpRouter = {
  /**
   * F2: the page snapshot (+ what the teacher said) → whose fault and who fixes it: from a symptom
   * of an uploaded BPMN (F2-08, checked against AlurSekolah first), else from WS-05.
   */
  helpExplain: schoolProcedure
    .input(
      z.object({ snapshot: pageSnapshotSchema, question: z.string().trim().max(500).nullable() }),
    )
    .handler(async ({ context, input }) => {
      const teacher = await context.caller.requireTeacher();
      return explain(
        {
          ...helpDeps(context),
          questions: createTeacherQuestionRepository(context.db),
          processes: {
            ai: context.school.ai,
            catalog: createCatalogRepository(context.db),
            files: context.documentFiles,
            alurSekolah: context.school.alurSekolah,
          },
        },
        teacher,
        context.caller.workspaceId,
        input,
      );
    }),

  /** F3-04/F3-07: a question answered only from active school knowledge, with verified citations. */
  helpAsk: schoolProcedure
    .input(z.object({ question: z.string().trim().min(1).max(500) }))
    .handler(async ({ context, input }) => {
      const teacher = await context.caller.requireTeacher();
      return askTeacher(
        { ...helpDeps(context), questions: createTeacherQuestionRepository(context.db) },
        teacher,
        context.caller.workspaceId,
        input.question,
      );
    }),

  /** WS-09 Uji jawaban (operator or Admin Javan): the answer with chosen inactive documents. */
  helpTryAnswer: schoolAdminProcedure
    .input(
      z.object({
        question: z.string().trim().min(1).max(500),
        documentIds: z.array(z.string().min(1)).max(50),
      }),
    )
    .handler(({ context, input }) =>
      tryAnswer(
        { ...helpDeps(context), catalog: createCatalogRepository(context.db) },
        context.session.user.workspaceId,
        input.question,
        input.documentIds,
      ),
    ),

  /**
   * Routes a transcript to a feature; voice controls are recognized without a model call. A
   * question the rules call "tanya" goes to "kenapa" when it matches an uploaded BPMN's symptom.
   */
  helpRoute: schoolProcedure
    .input(z.object({ utterance: z.string().trim().min(1).max(500) }))
    .handler(({ context, input }) =>
      route(
        {
          ...helpDeps(context),
          processes: { ai: context.school.ai, catalog: createCatalogRepository(context.db) },
        },
        context.caller.workspaceId,
        input.utterance,
      ),
    ),
};
