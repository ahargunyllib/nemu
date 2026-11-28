import { spokenName } from "@nemu/ai/school/grades/guided";
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
 *
 * Under each line, a quieter detail (F1·09, F1·10): the row before is confirmed and the lit field
 * named ("Alya 90 sudah benar. Kolom Bagas bersinar oranye."), and a difference says what she
 * typed ("Ibu mengetik 86. Ganti dulu, lalu lanjut.").
 */
export function gradeGuide(input: {
  /** The checked grades of this run; null when they are gone (the flow was closed). */
  entries: () => Promise<GradeEntry[] | null>;
  line: GuidedLineSource;
  /** "Ibu" / "Bapak", for the detail lines. */
  address: () => string;
}): CaraTwoGuide {
  async function find(step: GuidedStep) {
    const entries = await input.entries();
    const entry = entries?.find((item) => item.name === step.target.row);
    return entries && entry ? { entries, entry } : null;
  }

  /** "Alya 90 sudah benar. Kolom Bagas bersinar oranye." */
  function pointing(step: GuidedStep, entries: GradeEntry[], entry: GradeEntry): string {
    const name = spokenName(entry, entries);
    const catatan = step.target.column === "Catatan";
    // On the Catatan, the value just typed in the same row; on a Nilai, the row above.
    const done = catatan ? entry : entries[entries.indexOf(entry) - 1];
    const field = catatan ? `Kolom Catatan ${name}` : `Kolom ${name}`;
    if (!done) return `${field} bersinar oranye.`;
    const doneName = spokenName(done, entries);
    const confirmed =
      done.status === "value" && done.value !== null
        ? `${doneName} ${done.value} sudah benar.`
        : `${doneName} sudah dikosongkan.`;
    return `${confirmed} ${field} bersinar oranye.`;
  }

  return {
    async prompt(step) {
      const found = await find(step);
      if (!found) return null;
      const { entries, entry } = found;
      const detail = pointing(step, entries, entry);
      if (step.target.column === "Nilai") {
        const line = await input.line(entries, entry.studentId, null);
        return line ? { sentence: line.sentence, detail } : null;
      }
      if (step.target.column !== "Catatan") return null;
      const write = `Di Catatan ${entry.name}, tulis ${step.value}.`;
      if (entry.status === "value") return { sentence: write, detail };
      const blank = await input.line(entries, entry.studentId, null);
      return { sentence: blank ? `${blank.sentence} ${write}` : write, detail };
    },

    async check(step, typed) {
      if (step.target.column !== "Nilai") return null;
      const found = await find(step);
      if (!found) return null;
      const line = await input.line(found.entries, found.entry.studentId, typed);
      if (!line || line.ok === null) return null;
      if (line.ok) return { ok: true, sentence: line.sentence };
      const address = input.address();
      const detail =
        typed.trim() === ""
          ? `${address} mengosongkannya. Isi dulu, lalu lanjut.`
          : found.entry.status === "value"
            ? `${address} mengetik ${typed.trim()}. Ganti dulu, lalu lanjut.`
            : `${address} mengetik ${typed.trim()}. Kosongkan dulu, lalu lanjut.`;
      return { ok: false, sentence: line.sentence, detail };
    },
  };
}
