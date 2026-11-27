import type { GradeEntry } from "@nemu/contracts/school";

import type { CaraTwoGuide, GuidedStep } from "../../executor/lib/run";

/** `gradesGuidedLine` from the Nemu Service, or null when it can't be reached. */
export type GuidedLineSource = (
  entries: GradeEntry[],
  studentId: string,
  typed: string | null,
) => Promise<{ sentence: string; ok: boolean | null } | null>;

/**
 * F1's cara 2 words (F1-11, #208). For a student's Nilai, Nemu says `gradesGuidedLine`'s prompt
 * ("Ketik 84 untuk Dimas.") and, once the teacher leaves the field, its check: "Di buku 84, Bu."
 * when what she typed differs from the book, never "salah". For the Catatan beside it, Nemu says
 * what to write; for an absent student it first says the grade stays blank.
 */
export function gradeGuide(input: {
  /** The checked grades of this run; null when they are gone (the flow was closed). */
  entries: () => Promise<GradeEntry[] | null>;
  line: GuidedLineSource;
}): CaraTwoGuide {
  async function find(step: GuidedStep) {
    const entries = await input.entries();
    const entry = entries?.find((item) => item.name === step.target.row);
    return entries && entry ? { entries, entry } : null;
  }

  return {
    async prompt(step) {
      const found = await find(step);
      if (!found) return null;
      const { entries, entry } = found;
      if (step.target.column === "Nilai")
        return (await input.line(entries, entry.studentId, null))?.sentence ?? null;
      if (step.target.column !== "Catatan") return null;
      const write = `Di Catatan ${entry.name}, tulis ${step.value}.`;
      if (entry.status === "value") return write;
      const blank = await input.line(entries, entry.studentId, null);
      return blank ? `${blank.sentence} ${write}` : write;
    },

    async check(step, typed) {
      if (step.target.column !== "Nilai") return null;
      const found = await find(step);
      if (!found) return null;
      const line = await input.line(found.entries, found.entry.studentId, typed);
      if (!line || line.ok === null) return null;
      return { ok: line.ok, sentence: line.sentence };
    },
  };
}
