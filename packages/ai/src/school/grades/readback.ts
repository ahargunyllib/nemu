import type { GradeEntry, ReadbackResult, ReadbackRow } from "@nemu/contracts/school";

import { canonicalName } from "../names.js";
import { parseGradeValue } from "./reading.js";

/** F1-10: after the teacher saves, compare what AlurSekolah stored (Rekap Nilai) with the source. */

function expectedText(entry: GradeEntry): string {
  return entry.status === "value" && entry.value !== null ? String(entry.value) : "";
}

function savedText(raw: string): string {
  const value = parseGradeValue(raw);
  if (value !== null) return String(value);
  return /^(-|–|)$/u.test(raw.trim()) ? "" : raw.trim();
}

export function diffReadback(
  entries: readonly GradeEntry[],
  saved: readonly ReadbackRow[],
): ReadbackResult {
  const savedByName = new Map(saved.map((row) => [canonicalName(row.name), savedText(row.value)]));
  const mismatches: ReadbackResult["mismatches"] = [];
  for (const entry of entries) {
    const expected = expectedText(entry);
    const stored = savedByName.get(canonicalName(entry.name));
    if (stored === undefined || stored !== expected) {
      mismatches.push({
        studentId: entry.studentId,
        name: entry.name,
        expected: expected || "kosong",
        saved: stored === undefined ? null : stored || "kosong",
      });
    }
  }
  if (!mismatches.length) {
    return { match: true, mismatches, sentence: "Sudah saya cek, sama dengan buku." };
  }
  const first = mismatches[0]!;
  const others = mismatches.length > 1 ? ` dan ${mismatches.length - 1} lainnya` : "";
  return {
    match: false,
    mismatches,
    sentence: `Nilai ${first.name}${others} belum sama dengan buku.`,
  };
}
