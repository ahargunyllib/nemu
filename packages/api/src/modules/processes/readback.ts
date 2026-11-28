import type { FormTableRow } from "@nemu/contracts/school";

import type { AlurSekolahClient } from "../alursekolah/client";

/**
 * F3·08: after the teacher presses Simpan setoran, the rows Nemu filled are read back from
 * AlurSekolah API v1 (`/hafalan/setoran`, with the school's WS-07 key) and compared cell by cell,
 * the way F1-10 reads the grades back. Only the API's own columns are compared: a field id that is
 * one of its aspects (`skor.tajwid`), one of its columns, or a range (`ayat_dari` → `ayat_awal`).
 */

type Setoran = Awaited<ReturnType<AlurSekolahClient["hafalanSetoran"]>>["data"][number];

export type SetoranReadback = {
  /** Rows Nemu filled, and how many AlurSekolah holds exactly as filled. */
  total: number;
  matched: number;
  /** Students AlurSekolah has no setoran for on that date. */
  missing: string[];
  /** "Citra Lestari: tajwid": cells that differ. */
  different: string[];
};

/** The API's column for a form field, where its name differs from the field id. */
const COLUMN_FOR: Record<string, keyof Setoran> = {
  surah: "surah_nama",
  ayat_dari: "ayat_awal",
  ayat_sampai: "ayat_akhir",
};

function normalize(value: unknown): string {
  return String(value ?? "")
    .toLocaleLowerCase("id-ID")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

/** The saved value for a field, or undefined when the API has no such column. */
function savedValue(record: Setoran, fieldId: string): unknown {
  const skor = record.skor ?? null;
  if (skor && fieldId in skor) return skor[fieldId];
  const column = COLUMN_FOR[fieldId] ?? (fieldId as keyof Setoran);
  return column in record ? record[column] : undefined;
}

/** Pure: what Nemu filled against what AlurSekolah stored. */
export function compareSetoran(
  rows: readonly FormTableRow[],
  saved: readonly Setoran[],
): SetoranReadback {
  const missing: string[] = [];
  const different: string[] = [];
  let matched = 0;
  for (const row of rows) {
    const record = saved.find((item) => normalize(item.nama_siswa) === normalize(row.name));
    if (!record) {
      missing.push(row.name);
      continue;
    }
    const wrong = Object.entries(row.values).filter(([fieldId, value]) => {
      const stored = savedValue(record, fieldId);
      return stored !== undefined && normalize(stored) !== normalize(value);
    });
    if (wrong.length) different.push(`${row.name}: ${wrong.map(([id]) => id).join(", ")}`);
    else matched += 1;
  }
  return { total: rows.length, matched, missing, different };
}

export async function readbackSetoran(
  alurSekolah: Pick<AlurSekolahClient, "hafalanSetoran">,
  input: { rows: readonly FormTableRow[]; className: string | null; date: string | null },
): Promise<SetoranReadback> {
  const { data } = await alurSekolah.hafalanSetoran({
    ...(input.className ? { kelas: input.className } : {}),
    ...(input.date ? { tanggal: input.date } : {}),
  });
  // The newest first: a setoran saved again replaces the older one for that student.
  return compareSetoran(input.rows, data);
}
