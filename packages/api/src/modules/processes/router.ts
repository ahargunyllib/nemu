import {
  formTableSchema,
  narrationSegmentSchema,
  procedureSchema,
  recordedEventSchema,
} from "@nemu/contracts/school";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

import type { Context } from "../../context";
import { schoolAdminProcedure, schoolProcedure } from "../../index";
import { createCatalogRepository } from "../documents/catalog-repository";
import { createDocumentRepository } from "../documents/repository";
import {
  compileRecording,
  exportProcedureBpmn,
  getRecording,
  saveRecording,
  getProcedure,
  listProcedures,
  listProcesses,
  matchProcessFields,
  planProcess,
  readProcessPhoto,
  processXml,
  runProcedure,
  saveProcedure,
} from "./service";

function processDeps(context: Pick<Context, "db" | "school" | "documentFiles">) {
  const catalog = createCatalogRepository(context.db);
  return {
    ai: context.school.ai,
    documents: createDocumentRepository(context.db),
    files: context.documentFiles,
    elements: { list: catalog.listProcessElements.bind(catalog) },
    inbox: context.school.inbox,
    directory: context.school.directory,
  };
}

const documentIdSchema = z.object({ documentId: z.string().min(1) });
const slotValueSchema = z.union([z.string().max(500), z.number(), z.boolean(), z.null()]);

export const processesRouter = {
  /** Active BPMN processes (uploaded as .bpmn in Admin → Documents). */
  processList: schoolProcedure.handler(({ context }) =>
    listProcesses(processDeps(context), context.caller.workspaceId),
  ),

  /** The BPMN XML for the viewer (W9: highlight `activeTaskId`). */
  processXml: schoolProcedure.input(documentIdSchema).handler(async ({ context, input }) => {
    const xml = await processXml(
      processDeps(context),
      context.caller.workspaceId,
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
        table: formTableSchema.nullish(),
      }),
    )
    .handler(async ({ context, input }) => {
      const teacher = await context.caller.requireTeacher();
      const plan = await planProcess(
        processDeps(context),
        teacher,
        context.caller.workspaceId,
        context.demoDate,
        input,
      );
      if (!plan) throw new ORPCError("NOT_FOUND", { message: "Process not found" });
      return plan;
    }),

  /**
   * F3-16: the photo in the teacher's inbox (`jobId`) read against the task the plan asked about.
   * Send the returned `slots` and, once the teacher answered `questions`, `table` to `processPlan`.
   */
  processReadPhoto: schoolProcedure
    .input(
      documentIdSchema.extend({
        jobId: z.string().min(1).max(80),
        taskId: z.string().min(1).max(200),
        slots: z.record(z.string(), slotValueSchema),
      }),
    )
    .handler(async ({ context, input }) => {
      const teacher = await context.caller.requireTeacher();
      const result = await readProcessPhoto(
        processDeps(context),
        teacher,
        context.caller.workspaceId,
        input,
      );
      if (!result)
        throw new ORPCError("NOT_FOUND", { message: "Process, task or photo not found" });
      return result;
    }),
  /** F3-17: each BPMN form field → the label this page shows for it, or null. */
  processMatchFields: schoolProcedure
    .input(
      z.object({
        fields: z
          .array(z.object({ id: z.string().min(1).max(80), label: z.string().min(1).max(200) }))
          .max(60),
        pageLabels: z.array(z.string().min(1).max(200)).max(200),
      }),
    )
    .handler(({ context, input }) => matchProcessFields(processDeps(context), input)),
  /** F3-01: "Rekam cara" from the extension; the operator reviews it in the Admin Workspace. */
  procedureRecordingSave: schoolProcedure
    .input(
      z.object({
        title: z.string().trim().min(1).max(200),
        events: z.array(recordedEventSchema).min(1).max(500),
        narration: z.array(narrationSegmentSchema).max(200),
      }),
    )
    .handler(async ({ context, input }) => {
      const teacher = await context.caller.requireTeacher();
      const recording = await saveRecording(
        processDeps(context),
        teacher,
        context.caller.workspaceId,
        input,
      );
      return { recordingId: recording.recordingId, recordedBy: recording.recordedBy };
    }),
  procedureRecording: schoolAdminProcedure
    .input(z.object({ recordingId: z.string().uuid() }))
    .handler(async ({ context, input }) => {
      const recording = await getRecording(
        processDeps(context),
        context.session.user.workspaceId,
        input.recordingId,
      );
      if (!recording) throw new ORPCError("NOT_FOUND", { message: "Rekaman tidak ditemukan." });
      return recording;
    }),
  /** F3-03: a saved procedure as BPMN 2.0 XML (bpmn-moddle, laid out with bpmn-auto-layout). */
  procedureExportBpmn: schoolAdminProcedure
    .input(documentIdSchema)
    .handler(async ({ context, input }) => {
      const exported = await exportProcedureBpmn(
        processDeps(context),
        context.session.user.workspaceId,
        input.documentId,
      );
      if (!exported) throw new ORPCError("NOT_FOUND", { message: "Procedure not found" });
      return exported;
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
    listProcedures(processDeps(context), context.caller.workspaceId),
  ),

  procedureGet: schoolProcedure.input(documentIdSchema).handler(async ({ context, input }) => {
    const procedure = await getProcedure(
      processDeps(context),
      context.caller.workspaceId,
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
        context.caller.workspaceId,
        input.documentId,
        input.values,
      );
      if (!run) throw new ORPCError("NOT_FOUND", { message: "Procedure not found" });
      return run;
    }),
};
