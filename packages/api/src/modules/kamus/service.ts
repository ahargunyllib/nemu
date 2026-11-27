import { type Grid, readWorkbookGrids } from "@nemu/ai/school/grades/excel";
import type { KamusRow } from "@nemu/ai/school/kamus";

import type { KamusEntry, KamusFixer, KamusRepository } from "./repository";

/** WS-05 Kamus Kendala: rows the operator types or imports, read by "ini kenapa?" (F2). */

/** The rows "ini kenapa?" matches the page against (`@nemu/ai/school/kamus`). */
export async function loadKamusRows(
  kamus: Pick<KamusRepository, "list">,
  workspaceId: string,
): Promise<KamusRow[]> {
  return (await kamus.list(workspaceId)).map(
    ({ id, code, app, message, meaning, teacherFault, fixer, fix }) => ({
      id,
      code,
      app,
      message,
      meaning,
      teacherFault,
      fixer,
      fix,
    }),
  );
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

const FIXER_WORDS: Array<[KamusFixer, RegExp]> = [
  ["kepsek", /kepala|kepsek|atasan/u],
  ["keuangan", /keuangan|bendahara/u],
  ["dinas", /dinas|pengawas/u],
  ["operator", /operator|tata usaha|admin/u],
  ["guru", /guru/u],
];

/**
 * "Kepala Sekolah" → kepsek; the role a sheet names in its own words. The role named first wins:
 * "Operator sekolah (bersama kepala sekolah …)" is the operator's.
 */
export function parseFixer(text: string): KamusFixer | null {
  const value = text.trim().toLowerCase();
  let first: { role: KamusFixer; at: number } | null = null;
  for (const [role, pattern] of FIXER_WORDS) {
    const at = value.search(pattern);
    if (at >= 0 && (!first || at < first.at)) first = { role, at };
  }
  return first?.role ?? null;
}

/** "7" → "K-07", so an official kamus numbered 1, 2, … lands on the K-xx rows. */
function kamusCode(raw: string, fallback: number): string {
  if (/^\d{1,2}$/u.test(raw)) return `K-${raw.padStart(2, "0")}`;
  return raw || `K-${String(fallback).padStart(2, "0")}`;
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
      code: kamusCode(cell(columns.code), entries.length + 1),
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
 * The kamus as JSON, the shape the school's kamus file uses: `{isi: [{no, aplikasi, pesan, arti,
 * siapa, langkah}]}` or the array itself. Read through the same headers as an Excel sheet.
 */
export function parseKamusJson(text: string): KamusImportResult {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return { entries: [], skipped: [{ row: 1, reason: "File JSON tidak bisa dibaca" }] };
  }
  const list = Array.isArray(value)
    ? value
    : value && typeof value === "object" && Array.isArray((value as { isi?: unknown }).isi)
      ? (value as { isi: unknown[] }).isi
      : [];
  const rows = list.filter(
    (item): item is Record<string, unknown> => !!item && typeof item === "object",
  );
  const keys = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const asText = (cell: unknown) =>
    typeof cell === "string" || typeof cell === "number" || typeof cell === "boolean"
      ? String(cell)
      : "";
  return parseKamusGrid([keys, ...rows.map((row) => keys.map((key) => asText(row[key])))]);
}

/**
 * Imports a kamus file (Excel, or the JSON the school's kamus comes as): a row whose code is
 * already in the kamus replaces it, the rest are added. Returns how many rows went in and which
 * were skipped.
 */
export async function importKamusFile(
  kamus: KamusRepository,
  workspaceId: string,
  file: { name: string; bytes: Uint8Array },
): Promise<{ imported: number; skipped: KamusImportResult["skipped"] }> {
  const { entries, skipped } = /\.json$/iu.test(file.name)
    ? parseKamusJson(new TextDecoder().decode(file.bytes))
    : parseKamusGrid((await readWorkbookGrids(file.bytes))[0]?.grid ?? []);
  const existing = new Map((await kamus.list(workspaceId)).map((row) => [row.code, row.id]));
  for (const entry of entries) {
    const id = existing.get(entry.code);
    if (id) await kamus.update(workspaceId, id, entry);
    else await kamus.insert(workspaceId, entry);
  }
  return { imported: entries.length, skipped };
}
