import { parseGradeCommand } from "@nemu/ai/school/commands";
import { guidedCheck, guidedPrompt } from "@nemu/ai/school/grades/guided";
import { diffReadback } from "@nemu/ai/school/grades/readback";
import { applySchoolRules } from "@nemu/ai/school/grades/rules";
import { applyAnswers, buildVerificationPlan } from "@nemu/ai/school/grades/verification";
import type { TeacherProfile } from "@nemu/ai/school/profile";
import type { SchoolAi } from "@nemu/ai/school/runtime";
import type {
  GradeCommand,
  GradeEntry,
  GradeRulesResult,
  GradeSheetReading,
  ReadbackResult,
  ReadbackRow,
  VerificationAnswer,
  VerificationPlan,
} from "@nemu/contracts/school";

import type { DocumentRepository } from "../documents/repository";
import type { RuleSourceRepository } from "../rule-sources/repository";
import type { SchoolDirectory } from "../school/directory";
import { schoolRuleCitations } from "../school/knowledge";

/** F1 (AI_TECHNICAL_PRD §3): everything after the photo is read. Stateless: the client keeps the reading. */

export type GradesDeps = {
  ai: Pick<SchoolAi, "parseGradeExcel">;
  directory: SchoolDirectory;
  documents: Pick<DocumentRepository, "listActiveReadyChunks">;
  ruleSources: Pick<RuleSourceRepository, "list">;
};

export function parseCommand(teacher: TeacherProfile, utterance: string): GradeCommand {
  return parseGradeCommand(utterance, teacher);
}

export type SheetResult =
  | { status: "ok"; reading: GradeSheetReading; verification: VerificationPlan }
  | { status: "unreadable" | "no_roster"; sentence: string };

export async function parseExcel(
  deps: Pick<GradesDeps, "ai" | "directory">,
  teacher: TeacherProfile,
  input: { className: string; assessment: string | null; bytes: Uint8Array },
): Promise<SheetResult> {
  const roster = await deps.directory.roster(teacher.teacherId, input.className);
  if (!roster.length) {
    return {
      status: "no_roster",
      sentence: `Daftar siswa kelas ${input.className} belum ada di Nemu.`,
    };
  }
  const result = await deps.ai.parseGradeExcel({
    bytes: input.bytes,
    roster,
    assessment: input.assessment,
  });
  if (result.status !== "ok") return { status: "unreadable", sentence: result.sentence };
  return {
    status: "ok",
    reading: result.reading,
    verification: buildVerificationPlan(result.reading),
  };
}

/** Applies the teacher's answers, then the cited school rules (KKM, absence). */
export async function finalizeGrades(
  deps: Pick<GradesDeps, "directory" | "documents" | "ruleSources">,
  teacher: TeacherProfile,
  workspaceId: string,
  input: { reading: GradeSheetReading; answers: VerificationAnswer[] },
): Promise<GradeRulesResult> {
  const applied = applyAnswers(input.reading, input.answers);
  if (applied.status === "unresolved") {
    return {
      status: "unresolved",
      lines: applied.lines,
      sentence: `Masih ada ${applied.lines.length} baris yang perlu dicek, ${teacher.honorific}.`,
    };
  }
  const [config, citations] = await Promise.all([
    deps.directory.gradeConfig(teacher.teacherId),
    schoolRuleCitations(deps, workspaceId),
  ]);
  return applySchoolRules(applied.column, applied.entries, config, citations);
}

export function readback(entries: GradeEntry[], saved: ReadbackRow[]): ReadbackResult {
  return diffReadback(entries, saved);
}

export type GuidedLine = { sentence: string; ok: boolean | null };

/** F1-11: the next prompt, or the check of what the teacher typed. */
export function guidedLine(
  teacher: TeacherProfile,
  entries: GradeEntry[],
  studentId: string,
  typed: string | null,
): GuidedLine | null {
  const entry = entries.find((item) => item.studentId === studentId);
  if (!entry) return null;
  if (typed === null) return { sentence: guidedPrompt(entry, entries), ok: null };
  const check = guidedCheck(entry, typed, teacher.honorific);
  return { sentence: check.sentence, ok: check.ok };
}
