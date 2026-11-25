import {
  gradeEntrySchema,
  gradeSheetReadingSchema,
  readbackRowSchema,
  verificationAnswerSchema,
} from "@nemu/contracts/school";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

import type { AuthenticatedContext } from "../../context";
import { schoolProcedure } from "../../index";
import { createDocumentRepository } from "../documents/repository";
import { createRuleSourceRepository } from "../rule-sources/repository";
import { requireTeacher } from "../school/teacher";
import { finalizeGrades, guidedLine, parseCommand, parseExcel, readback } from "./service";

const MAX_EXCEL_BYTES = 5 * 1024 * 1024;

function gradesDeps(context: AuthenticatedContext) {
  return {
    ai: context.school.ai,
    directory: context.school.directory,
    documents: createDocumentRepository(context.db),
    ruleSources: createRuleSourceRepository(context.db),
  };
}

export const gradesRouter = {
  /** "masukkan nilai UTS Matematika 4B" → class, subject, assessment, or one question (F1-05). */
  gradesParseCommand: schoolProcedure
    .input(z.object({ utterance: z.string().trim().min(1).max(500) }))
    .handler(async ({ context, input }) => {
      const teacher = await requireTeacher(context.school.directory, context.session.user.id);
      return parseCommand(teacher, input.utterance);
    }),

  /** F1-02: an Excel file becomes a reading plus the verification questions. */
  gradesParseExcel: schoolProcedure
    .input(
      z.object({
        className: z.string().trim().min(1).max(20),
        assessment: z.string().trim().max(40).nullable(),
        file: z
          .instanceof(File)
          .refine(
            (file) => /\.(xlsx|xls|csv)$/iu.test(file.name),
            "Upload an Excel (.xlsx, .xls) or CSV file",
          )
          .refine((file) => file.size <= MAX_EXCEL_BYTES, "Upload a file no larger than 5 MB"),
      }),
    )
    .handler(async ({ context, input }) => {
      const teacher = await requireTeacher(context.school.directory, context.session.user.id);
      const bytes = new Uint8Array(await input.file.arrayBuffer());
      return parseExcel(gradesDeps(context), teacher, {
        className: input.className,
        assessment: input.assessment,
        bytes,
      });
    }),

  /** After the verification screens (W5): answers + KKM/absence rules, each cited (F1-07). */
  gradesFinalize: schoolProcedure
    .input(
      z.object({
        reading: gradeSheetReadingSchema,
        answers: z.array(verificationAnswerSchema).max(200),
      }),
    )
    .handler(async ({ context, input }) => {
      const teacher = await requireTeacher(context.school.directory, context.session.user.id);
      return finalizeGrades(gradesDeps(context), teacher, context.session.user.workspaceId, input);
    }),

  /** F1-10: compare Rekap Nilai (scraped by the extension) with what the teacher verified. */
  gradesReadback: schoolProcedure
    .input(
      z.object({
        entries: z.array(gradeEntrySchema).max(100),
        saved: z.array(readbackRowSchema).max(200),
      }),
    )
    .handler(({ input }) => readback(input.entries, input.saved)),

  /** F1-11 guided mode: "Ketik 77 untuk Budi." or, with `typed`, "Di buku 77, Bu." */
  gradesGuidedLine: schoolProcedure
    .input(
      z.object({
        entries: z.array(gradeEntrySchema).max(100),
        studentId: z.string().min(1),
        typed: z.string().max(20).nullable(),
      }),
    )
    .handler(async ({ context, input }) => {
      const teacher = await requireTeacher(context.school.directory, context.session.user.id);
      const line = guidedLine(teacher, input.entries, input.studentId, input.typed);
      if (!line) throw new ORPCError("NOT_FOUND", { message: "Student not in these entries" });
      return line;
    }),
};
