import { z } from "zod";

import type { GradeCell, GradeRow, GradeSheetReading } from "@nemu/contracts/school";

import type { JsonCall } from "../llm.js";
import { matchNames, type RosterStudent } from "../names.js";
import { parseGradeValue } from "./reading.js";

/**
 * F1-02: a free-format Excel (columns in any order, title rows, CAPS names, an average row) becomes
 * the same GradeSheetReading as a photo. Parsing is deterministic; a cheap model maps headers only
 * when no "Nama" header can be found, and it sees headers plus masked samples, never grades.
 */

export type Grid = string[][];

export type HeaderMap = {
  headerRow: number;
  nameCol: number;
  gradeCols: Array<{ col: number; label: string }>;
};

const SUMMARY_ROW =
  /\b(rata[-\s]?rata|rerata|jumlah|total|tertinggi|terendah|kkm|keterangan|nilai\s+(max|min))\b/iu;
const ASSESSMENT_HEADER =
  /\b(uh|uts|uas|pts|pas|pat|tugas|pr|ulangan|harian|nilai|praktik|proyek|sumatif|formatif|sts|sas)\b/iu;
const NAME_HEADER = /\bnama\b/iu;
const BLANK_VALUES = new Set(["", "-", "–", "tl", "t/l"]);

export async function readWorkbookGrids(
  bytes: Uint8Array,
): Promise<Array<{ name: string; grid: Grid }>> {
  const { read, utils } = await import("xlsx");
  const workbook = read(bytes, { type: "array" });
  return workbook.SheetNames.map((name) => {
    const sheet = workbook.Sheets[name]!;
    const rows = utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: "" });
    return { name, grid: rows.map((row) => row.map((cell) => String(cell ?? "").trim())) };
  });
}

function numericShare(grid: Grid, col: number, fromRow: number): number {
  let numeric = 0;
  let filled = 0;
  for (let row = fromRow; row < grid.length; row += 1) {
    const value = grid[row]?.[col]?.trim() ?? "";
    if (!value) continue;
    filled += 1;
    if (parseGradeValue(value) !== null || /^[SIA]$/iu.test(value)) numeric += 1;
  }
  return filled ? numeric / filled : 0;
}

/** Finds the header row by a "Nama" cell, then grade columns by header word or numeric content. */
export function detectHeaders(grid: Grid): HeaderMap | null {
  for (let row = 0; row < Math.min(grid.length, 20); row += 1) {
    const cells = grid[row] ?? [];
    const nameCol = cells.findIndex((cell) => NAME_HEADER.test(cell));
    if (nameCol < 0) continue;
    const gradeCols = cells
      .map((label, col) => ({ col, label }))
      .filter(({ col, label }) => {
        if (col === nameCol || !label) return false;
        if (/^(no|nis|nisn|nomor|l\/p|jk)\.?$/iu.test(label)) return false;
        return ASSESSMENT_HEADER.test(label) || numericShare(grid, col, row + 1) >= 0.8;
      });
    return { headerRow: row, nameCol, gradeCols };
  }
  return null;
}

const headerMapSchema = z.object({
  header_row: z.number().int(),
  name_col: z.number().int(),
  grade_cols: z.array(z.object({ col: z.number().int(), label: z.string() })),
});

const HEADER_MAP_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["header_row", "name_col", "grade_cols"],
  properties: {
    header_row: { type: "integer" },
    name_col: { type: "integer" },
    grade_cols: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["col", "label"],
        properties: { col: { type: "integer" }, label: { type: "string" } },
      },
    },
  },
} as const;

const HEADER_WORDS = /\b(nama|siswa|peserta|murid|no|nomor|nis|nisn|nilai|kelas|skor|mapel)\b/iu;

/** Grades become "##" and person names "Nama", so the model sees structure, not student data. */
export function maskGrid(grid: Grid, rows = 15): Grid {
  return grid.slice(0, rows).map((row) =>
    row.map((cell) => {
      if (parseGradeValue(cell) !== null) return "##";
      const words = cell.trim().split(/\s+/u).filter(Boolean);
      const looksLikeName =
        /^[\p{L}.'\s]+$/u.test(cell.trim()) && words.length >= 2 && !HEADER_WORDS.test(cell);
      return looksLikeName ? "Nama" : cell;
    }),
  );
}

async function mapHeadersWithModel(call: JsonCall, grid: Grid): Promise<HeaderMap> {
  const masked = maskGrid(grid);
  const response = await call({
    instructions:
      "You map the columns of a teacher's grade spreadsheet. Rows and columns are 0-based. Return the header row, the student-name column and the grade columns.",
    content: [{ type: "text", text: JSON.stringify({ rows: masked }) }],
    schemaName: "grade_sheet_header_map",
    schema: HEADER_MAP_JSON_SCHEMA,
    parse: (value) => headerMapSchema.parse(value),
    maxOutputTokens: 600,
  });
  return {
    headerRow: response.header_row,
    nameCol: response.name_col,
    gradeCols: response.grade_cols,
  };
}

function titleCase(name: string): string {
  return name
    .toLocaleLowerCase("id-ID")
    .replace(
      /(^|[\s'-])(\p{L})/gu,
      (_, separator: string, letter: string) => separator + letter.toLocaleUpperCase("id-ID"),
    );
}

function excelCell(raw: string, column: string): GradeCell {
  const text = raw.trim();
  const base = { column, raw: text, readings: { a: text, b: null, reread: null }, bbox: null };
  if (BLANK_VALUES.has(text.toLowerCase())) {
    return { ...base, value: null, status: "blank", confidence: "high", reasons: [] };
  }
  const upper = text.toUpperCase();
  if (upper === "S" || upper === "I" || upper === "A") {
    return { ...base, value: null, status: upper, confidence: "medium", reasons: ["absence"] };
  }
  const value = parseGradeValue(text);
  if (value === null) {
    return { ...base, value: null, status: "value", confidence: "low", reasons: ["out_of_range"] };
  }
  return { ...base, value, status: "value", confidence: "high", reasons: [] };
}

export type ParseGradeExcelInput = {
  bytes: Uint8Array;
  roster: readonly RosterStudent[];
  assessment?: string | null;
};

export type ParseGradeExcelResult =
  | { status: "ok"; reading: GradeSheetReading }
  | { status: "unreadable"; sentence: string };

function pickGradeColumn(map: HeaderMap, assessment: string | null | undefined) {
  if (assessment) {
    const wanted = assessment.toLowerCase().replace(/\s+/gu, "");
    const match = map.gradeCols.find((column) =>
      column.label.toLowerCase().replace(/\s+/gu, "").includes(wanted),
    );
    if (match) return match;
  }
  return map.gradeCols.at(-1);
}

export async function parseGradeExcel(
  deps: { mapHeaders?: JsonCall },
  input: ParseGradeExcelInput,
): Promise<ParseGradeExcelResult> {
  const sheets = await readWorkbookGrids(input.bytes);
  const rosterNames = new Set(input.roster.map((student) => student.name.toLowerCase()));
  const ranked = sheets
    .map((sheet) => ({
      ...sheet,
      hits: sheet.grid.flat().filter((cell) => rosterNames.has(cell.toLowerCase())).length,
    }))
    .sort((left, right) => right.hits - left.hits);
  const sheet = ranked[0];
  if (!sheet) return { status: "unreadable", sentence: "File Excel-nya kosong, Bu." };

  let map = detectHeaders(sheet.grid);
  if ((!map || !map.gradeCols.length) && deps.mapHeaders)
    map = await mapHeadersWithModel(deps.mapHeaders, sheet.grid);
  const gradeColumn = map ? pickGradeColumn(map, input.assessment) : undefined;
  if (!map || !gradeColumn) {
    return { status: "unreadable", sentence: "Kolom nama dan nilai belum ketemu di file ini, Bu." };
  }

  const columnKey = `c${gradeColumn.col + 1}`;
  const dataRows: Array<{ line: number; name: string; raw: string }> = [];
  let skipped = 0;
  for (let index = map.headerRow + 1; index < sheet.grid.length; index += 1) {
    const row = sheet.grid[index] ?? [];
    const name = (row[map.nameCol] ?? "").trim();
    if (!name || SUMMARY_ROW.test(row.join(" "))) {
      if (row.some((cell) => cell.trim())) skipped += 1;
      continue;
    }
    dataRows.push({ line: dataRows.length + 1, name, raw: row[gradeColumn.col] ?? "" });
  }

  const matches = matchNames(
    dataRows.map((row) => ({ line: row.line, nameRaw: titleCase(row.name) })),
    input.roster,
  );
  const rows: GradeRow[] = dataRows.map((row, index) => {
    const match = matches[index]!;
    return {
      line: row.line,
      nameRaw: titleCase(row.name),
      studentId: match.studentId,
      rosterName: match.rosterName,
      nameScore: Math.round(match.score * 1000) / 1000,
      nameStatus: match.status,
      candidates: match.candidates,
      nameBox: null,
      cells: [excelCell(row.raw, columnKey)],
    };
  });

  const assigned = new Set(rows.map((row) => row.studentId).filter(Boolean));
  return {
    status: "ok",
    reading: {
      source: "excel",
      readable: true,
      issues: [],
      columns: map.gradeCols.map((column) => ({ key: `c${column.col + 1}`, label: column.label })),
      rows,
      unmatchedStudents: input.roster
        .filter((student) => !assigned.has(student.studentId))
        .map(({ studentId, name }) => ({ studentId, name })),
      skippedRows: skipped,
    },
  };
}
