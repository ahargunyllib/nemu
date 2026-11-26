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

import type { AlurSekolahClient, AlurSekolahNilai } from "../alursekolah/client";
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

/** Assessment names Nemu parses (F1-05) that AlurSekolah's `jenis` spells differently. */
const JENIS_ALIASES: Record<string, string> = { UH: "Harian", PTS: "UTS", PAS: "UAS" };

async function nilaiForAssessment(
  alurSekolah: Pick<AlurSekolahClient, "nilai">,
  filter: { kelas: string; mapel: string; semester?: string },
  assessment: string,
): Promise<AlurSekolahNilai[]> {
  const exact = await alurSekolah.nilai({ ...filter, jenis: assessment });
  const alias = JENIS_ALIASES[assessment.split(/\s+/u)[0]!.toUpperCase()];
  if (exact.data.length || !alias) return exact.data;
  return (await alurSekolah.nilai({ ...filter, jenis: alias })).data;
}

/**
 * F1-10 from AlurSekolah API v1 instead of a scraped Rekap Nilai: `/nilai` for the class, subject
 * and assessment, and `/siswa` for the class roster, so a student without a stored grade reads as
 * empty rather than missing. With several rows for one student, the newest wins.
 */
export async function readbackFromAlurSekolah(
  alurSekolah: Pick<AlurSekolahClient, "nilai" | "siswa">,
  input: {
    entries: GradeEntry[];
    className: string;
    subject: string;
    assessment: string;
    semester?: string | null;
  },
): Promise<ReadbackResult> {
  const filter = {
    kelas: input.className,
    mapel: input.subject,
    ...(input.semester ? { semester: input.semester } : {}),
  };
  const [roster, nilai] = await Promise.all([
    alurSekolah.siswa({ kelas: input.className }),
    nilaiForAssessment(alurSekolah, filter, input.assessment),
  ]);
  const newest = new Map<string, AlurSekolahNilai>();
  for (const row of nilai) {
    const current = newest.get(row.nis);
    const isNewer =
      !current ||
      (row.tanggal ?? "").localeCompare(current.tanggal ?? "") > 0 ||
      ((row.tanggal ?? "") === (current.tanggal ?? "") && row.id > current.id);
    if (isNewer) newest.set(row.nis, row);
  }
  const saved: ReadbackRow[] = roster.data.map((student) => ({
    name: student.nama,
    value: newest.has(student.nis) ? String(newest.get(student.nis)!.skor) : "",
  }));
  const rosterNis = new Set(roster.data.map((student) => student.nis));
  for (const row of newest.values()) {
    if (!rosterNis.has(row.nis))
      saved.push({ name: row.nama_siswa ?? row.nis, value: String(row.skor) });
  }
  return diffReadback(input.entries, saved);
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
