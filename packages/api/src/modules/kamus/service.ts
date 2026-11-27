import type { KnowledgeChunk } from "@nemu/ai";
import { type Grid, readWorkbookGrids } from "@nemu/ai/school/grades/excel";

import type { KamusEntry, KamusFixer, KamusRecord, KamusRepository } from "./repository";

/** WS-05 Kamus Kendala: rows the operator types or imports, read by "ini kenapa?" (F2). */

export const KAMUS_DOCUMENT = { docId: "kamus-kendala", title: "Kamus Kendala" } as const;

/**
 * One kamus row as the knowledge chunk F2 cites: `K-03 AlurSekolah: "pesan". Arti. Bukan
 * kesalahan guru. Yang dilakukan.` The quoted message is what the screen is matched against.
 */
export function kamusChunk(entry: KamusRecord): KnowledgeChunk {
  const sentence = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return "";
    return /[.!?]$/u.test(trimmed) ? trimmed : `${trimmed}.`;
  };
  const parts = [
    `${entry.code} ${entry.app}: "${entry.message.trim()}".`,
    sentence(entry.meaning),
    entry.teacherFault ? "" : "Bukan kesalahan guru.",
    sentence(entry.fix),
  ].filter(Boolean);
  return {
    id: `kamus-${entry.id}`,
    docId: KAMUS_DOCUMENT.docId,
    title: KAMUS_DOCUMENT.title,
    version: "WS-05",
    article: entry.code,
    active: true,
    text: parts.join(" "),
  };
}

export async function loadKamusChunks(
  kamus: Pick<KamusRepository, "list">,
  workspaceId: string,
): Promise<KnowledgeChunk[]> {
  return (await kamus.list(workspaceId)).map(kamusChunk);
}

const HEADERS: Record<keyof KamusEntry, RegExp> = {
  code: /^(kode|no\.?|nomor)$/iu,
  app: /^(aplikasi|app|situs)$/iu,
  message: /(pesan|error|kendala)/iu,
  meaning: /^(arti|artinya|penjelasan|maksud)/iu,
  teacherFault: /(kesalahan guru|salah guru|guru salah)/iu,
  fixer: /(memperbaiki|perbaik|penanggung|siapa)/iu,
  fix: /(dilakukan|langkah|solusi|tindakan|cara)/iu,
};

/** "Kepala Sekolah" → kepsek; the role a sheet names in its own words. */
export function parseFixer(text: string): KamusFixer | null {
  const value = text.trim().toLowerCase();
  if (!value) return null;
  if (/kepala|kepsek|atasan/u.test(value)) return "kepsek";
  if (/keuangan|bendahara/u.test(value)) return "keuangan";
  if (/dinas|pengawas/u.test(value)) return "dinas";
  if (/operator|tata usaha|admin/u.test(value)) return "operator";
  if (/guru/u.test(value)) return "guru";
  return null;
}

export type KamusImportResult = {
  entries: KamusEntry[];
  /** Rows that could not be read, numbered as in the sheet (1 = first row). */
  skipped: Array<{ row: number; reason: string }>;
};

/** Reads the first sheet with a "Pesan" header into kamus rows; deterministic, no model. */
export function parseKamusGrid(grid: Grid): KamusImportResult {
  // The header row names the message and at least two more columns; a title row above doesn't.
  const headerRow = grid.findIndex(
    (row) =>
      row.some((cell) => HEADERS.message.test(cell)) &&
      Object.values(HEADERS).filter((pattern) => row.some((cell) => pattern.test(cell))).length >=
        3,
  );
  if (headerRow === -1) {
    return { entries: [], skipped: [{ row: 1, reason: "Tidak ada kolom Pesan error" }] };
  }
  const header = grid[headerRow] ?? [];
  const column = (key: keyof KamusEntry) => header.findIndex((cell) => HEADERS[key].test(cell));
  const columns = {
    code: column("code"),
    app: column("app"),
    message: column("message"),
    meaning: column("meaning"),
    teacherFault: column("teacherFault"),
    fixer: column("fixer"),
    fix: column("fix"),
  };
  const entries: KamusEntry[] = [];
  const skipped: KamusImportResult["skipped"] = [];
  grid.slice(headerRow + 1).forEach((row, index) => {
    const rowNumber = headerRow + index + 2;
    const cell = (col: number) => (col === -1 ? "" : (row[col] ?? "").trim());
    if (row.every((value) => !value.trim())) return;
    const message = cell(columns.message);
    const fixer = parseFixer(cell(columns.fixer));
    const fix = cell(columns.fix);
    if (!message) return skipped.push({ row: rowNumber, reason: "Pesan error kosong" });
    if (!fixer) return skipped.push({ row: rowNumber, reason: "Yang memperbaiki tidak dikenali" });
    if (!fix) return skipped.push({ row: rowNumber, reason: "Yang dilakukan kosong" });
    entries.push({
      code: cell(columns.code) || `K-${String(entries.length + 1).padStart(2, "0")}`,
      app: cell(columns.app) || "AlurSekolah",
      message,
      meaning: cell(columns.meaning),
      teacherFault: /^(ya|y|benar|true|1)$/iu.test(cell(columns.teacherFault)),
      fixer,
      fix,
    });
  });
  return { entries, skipped };
}

/**
 * Imports an Excel sheet: a row whose code is already in the kamus replaces it, the rest are
 * added. Returns how many rows went in and which were skipped.
 */
export async function importKamusExcel(
  kamus: KamusRepository,
  workspaceId: string,
  bytes: Uint8Array,
): Promise<{ imported: number; skipped: KamusImportResult["skipped"] }> {
  const [sheet] = await readWorkbookGrids(bytes);
  const { entries, skipped } = parseKamusGrid(sheet?.grid ?? []);
  const existing = new Map((await kamus.list(workspaceId)).map((row) => [row.code, row.id]));
  for (const entry of entries) {
    const id = existing.get(entry.code);
    if (id) await kamus.update(workspaceId, id, entry);
    else await kamus.insert(workspaceId, entry);
  }
  return { imported: entries.length, skipped };
}
