import {
  gradeEntrySchema,
  gradeSheetReadingSchema,
  readbackRowSchema,
  verificationAnswerSchema,
} from "@nemu/contracts/school";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

import type { Context } from "../../context";
import { schoolProcedure } from "../../index";
import { AlurSekolahError } from "../alursekolah/client";
import { AlurSekolahNotConfiguredError } from "../alursekolah/connector";
import { MissingSecretKeyError } from "../integrations/cipher";
import { createDocumentRepository } from "../documents/repository";
import { createRuleSourceRepository } from "../rule-sources/repository";
import {
  finalizeGrades,
  guidedLine,
  parseCommand,
  parseExcel,
  readback,
  readbackFromAlurSekolah,
} from "./service";

const MAX_EXCEL_BYTES = 5 * 1024 * 1024;

function gradesDeps(context: Pick<Context, "db" | "school" | "documentFiles">) {
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
      const teacher = await context.caller.requireTeacher();
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
      const teacher = await context.caller.requireTeacher();
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
      const teacher = await context.caller.requireTeacher();
      return finalizeGrades(gradesDeps(context), teacher, context.caller.workspaceId, input);
    }),

  /**
   * F1-10: after the teacher presses Simpan, read the stored grades back from AlurSekolah API v1
   * (`/nilai`, with the school's WS-07 key) and compare them with what the teacher verified.
   */
  gradesReadbackAlurSekolah: schoolProcedure
    .input(
      z.object({
        entries: z.array(gradeEntrySchema).max(100),
        className: z.string().trim().min(1).max(20),
        subject: z.string().trim().min(1).max(60),
        assessment: z.string().trim().min(1).max(40),
        semester: z.string().trim().max(40).nullish(),
      }),
    )
    .handler(async ({ context, input }) => {
      const teacher = await context.caller.requireTeacher();
      const className = input.className.toUpperCase();
      if (!teacher.classes.some((item) => item.toUpperCase() === className)) {
        throw new ORPCError("FORBIDDEN", {
          message: `Kelas ${className} bukan kelas ${teacher.honorific} ${teacher.name}`,
        });
      }
      try {
        const alurSekolah = await context.school.alurSekolah(context.caller.workspaceId);
        return await readbackFromAlurSekolah(alurSekolah, { ...input, className });
      } catch (error) {
        if (
          error instanceof AlurSekolahNotConfiguredError ||
          error instanceof MissingSecretKeyError
        ) {
          throw new ORPCError("PRECONDITION_FAILED", { message: error.message, cause: error });
        }
        if (error instanceof AlurSekolahError) {
          throw new ORPCError("BAD_GATEWAY", { message: error.message, cause: error });
        }
        throw error;
      }
    }),

  /** F1-10 fallback: compare a Rekap Nilai the extension scraped with what the teacher verified. */
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
      const teacher = await context.caller.requireTeacher();
      const line = guidedLine(teacher, input.entries, input.studentId, input.typed);
      if (!line) throw new ORPCError("NOT_FOUND", { message: "Student not in these entries" });
      return line;
    }),
};
