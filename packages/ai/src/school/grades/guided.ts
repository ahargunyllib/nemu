import type { GradeEntry } from "@nemu/contracts/school";

import { parseGradeValue } from "./reading.js";

/**
 * F1-11 guided mode lines. Templates, not model calls: short, with the value and the student, and
 * never the word "salah" (F0-10).
 */

/** First name when it is unique in the class, the full name otherwise. */
export function spokenName(entry: GradeEntry, all: readonly GradeEntry[]): string {
  const first = entry.name.split(/\s+/u)[0] ?? entry.name;
  const clash = all.some(
    (other) => other.studentId !== entry.studentId && (other.name.split(/\s+/u)[0] ?? "") === first,
  );
  return clash ? entry.name : first;
}

export function guidedPrompt(entry: GradeEntry, all: readonly GradeEntry[]): string {
  const name = spokenName(entry, all);
  if (entry.status === "value" && entry.value !== null)
    return `Ketik ${entry.value} untuk ${name}.`;
  return `Untuk ${name} dikosongkan saja.`;
}

export type GuidedCheck = { ok: true; sentence: string } | { ok: false; sentence: string };

export function guidedCheck(entry: GradeEntry, typed: string, honorific = "Bu"): GuidedCheck {
  const typedValue = parseGradeValue(typed);
  const typedBlank = typed.trim() === "";
  if (entry.status !== "value" || entry.value === null) {
    return typedBlank
      ? { ok: true, sentence: "Sudah pas." }
      : { ok: false, sentence: `Di buku ini kosong, ${honorific}.` };
  }
  if (typedValue === entry.value) return { ok: true, sentence: "Sudah pas." };
  return { ok: false, sentence: `Di buku ${entry.value}, ${honorific}.` };
}
