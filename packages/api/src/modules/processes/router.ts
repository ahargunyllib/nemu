import {
  narrationSegmentSchema,
  procedureSchema,
  recordedEventSchema,
} from "@nemu/contracts/school";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

import type { AuthenticatedContext } from "../../context";
import { schoolAdminProcedure, schoolProcedure } from "../../index";
import { createDocumentRepository } from "../documents/repository";
import { requireTeacher } from "../school/teacher";
import {
  compileRecording,
  getProcedure,
  listProcedures,
  listProcesses,
  planProcess,
  processXml,
  runProcedure,
  saveProcedure,
} from "./service";

function processDeps(context: AuthenticatedContext) {
  return {
    ai: context.school.ai,
    documents: createDocumentRepository(context.db),
    files: context.documentFiles,
  };
}

const documentIdSchema = z.object({ documentId: z.string().min(1) });
const slotValueSchema = z.union([z.string().max(500), z.number(), z.boolean(), z.null()]);

export const processesRouter = {
  /** Active BPMN processes (uploaded as .bpmn in Admin → Documents). */
  processList: schoolProcedure.handler(({ context }) =>
    listProcesses(processDeps(context), context.session.user.workspaceId),
  ),

  /** The BPMN XML for the viewer (W9: highlight `activeTaskId`). */
  processXml: schoolProcedure.input(documentIdSchema).handler(async ({ context, input }) => {
    const xml = await processXml(
      processDeps(context),
      context.session.user.workspaceId,
      input.documentId,
    );
    if (xml === null) throw new ORPCError("NOT_FOUND", { message: "Process not found" });
    return { xml };
  }),

  /**
   * F3-09: one step of a BPMN-guided form. Stateless (ADR-0004): send back the returned `slots`
   * and the next `stepIndex`; send `text` when the teacher speaks or answers a question.
   */
  processPlan: schoolProcedure
    .input(
      documentIdSchema.extend({
        text: z.string().trim().max(500).nullable(),
        answering: z.string().max(80).nullable(),
        slots: z.record(z.string(), slotValueSchema),
        stepIndex: z.number().int().min(0).max(100),
      }),
    )
    .handler(async ({ context, input }) => {
      const teacher = await requireTeacher(context.school.directory, context.session.user.id);
      const plan = await planProcess(
        processDeps(context),
        teacher,
        context.session.user.workspaceId,
        context.demoDate,
        input,
      );
      if (!plan) throw new ORPCError("NOT_FOUND", { message: "Process not found" });
      return plan;
    }),

  /** F3-01: the operator's recording → parameterized steps for review (not saved yet). */
  procedureCompile: schoolAdminProcedure
    .input(
      z.object({
        title: z.string().trim().min(1).max(200),
        events: z.array(recordedEventSchema).min(1).max(500),
        narration: z.array(narrationSegmentSchema).max(200),
      }),
    )
    .handler(({ context, input }) => compileRecording(processDeps(context), input)),

  /** F3-02/F3-05: save the reviewed procedure as knowledge (activate/deactivate in Documents). */
  procedureSave: schoolAdminProcedure
    .input(
      z.object({
        title: z.string().trim().min(1).max(200),
        version: z.string().trim().min(1).max(50),
        isActive: z.boolean(),
        procedure: procedureSchema,
      }),
    )
    .handler(({ context, input }) =>
      saveProcedure(processDeps(context), context.session.user.workspaceId, input),
    ),

  procedureList: schoolProcedure.handler(({ context }) =>
    listProcedures(processDeps(context), context.session.user.workspaceId),
  ),

  procedureGet: schoolProcedure.input(documentIdSchema).handler(async ({ context, input }) => {
    const procedure = await getProcedure(
      processDeps(context),
      context.session.user.workspaceId,
      input.documentId,
    );
    if (!procedure) throw new ORPCError("NOT_FOUND", { message: "Procedure not found" });
    return procedure;
  }),

  /** Concrete steps for the executor; it stops at the first `requiresHumanAction` step. */
  procedureRun: schoolProcedure
    .input(documentIdSchema.extend({ values: z.record(z.string(), z.string().max(200)) }))
    .handler(async ({ context, input }) => {
      const run = await runProcedure(
        processDeps(context),
        context.session.user.workspaceId,
        input.documentId,
        input.values,
      );
      if (!run) throw new ORPCError("NOT_FOUND", { message: "Procedure not found" });
      return run;
    }),
};
