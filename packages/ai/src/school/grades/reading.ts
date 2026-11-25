import type {
  Box,
  FlagReason,
  GradeCell,
  GradeRow,
  GradeSheetReading,
} from "@nemu/contracts/school";

import type { LlmContent } from "../llm.js";
import { matchNames, type RosterStudent } from "../names.js";
import {
  READ_A_INSTRUCTIONS,
  READ_B_INSTRUCTIONS,
  readWithModel,
  rereadCells,
  type GradeReaders,
  type ModelCell,
  type ModelReading,
  type ModelRow,
  type RereadRequest,
} from "./vision.js";

/**
 * F1 photo pipeline (AI_TECHNICAL_PRD §3.1): two independent readers, deterministic checks, a crop
 * re-read of every doubtful cell, then roster matching in code. Model confidence alone never
 * accepts a cell.
 */

export type NormalizedCell = {
  status: "value" | "blank" | "S" | "I" | "A" | "illegible" | "invalid";
  value: number | null;
  /** Comparable text: "77", "blank", "S", "illegible", "invalid:abc". */
  key: string;
};

export function parseGradeValue(text: string | null | undefined): number | null {
  if (text === null || text === undefined) return null;
  const cleaned = text.replace(/\s+/gu, "").replace(",", ".");
  if (!/^\d{1,3}(\.\d{1,2})?$/u.test(cleaned)) return null;
  const value = Number(cleaned);
  return value >= 0 && value <= 100 ? value : null;
}

export function normalizeModelCell(cell: ModelCell | undefined): NormalizedCell | null {
  if (!cell) return null;
  if (cell.kind === "absence" && cell.absence) {
    return { status: cell.absence, value: null, key: cell.absence };
  }
  if (cell.kind === "blank") return { status: "blank", value: null, key: "blank" };
  if (cell.kind === "illegible") return { status: "illegible", value: null, key: "illegible" };
  const text = cell.struck && cell.replaced_by ? cell.replaced_by : cell.value;
  const absence = text?.trim().toUpperCase();
  if (absence === "S" || absence === "I" || absence === "A") {
    return { status: absence, value: null, key: absence };
  }
  const value = parseGradeValue(text);
  if (value === null) return { status: "invalid", value: null, key: `invalid:${text ?? ""}` };
  return { status: "value", value, key: String(value) };
}

/** Interprets a re-read answer; null when the reader was unsure. */
export function normalizeRereadValue(text: string | undefined): NormalizedCell | null {
  if (!text) return null;
  const trimmed = text.trim();
  if (!trimmed || trimmed === "?") return null;
  const upper = trimmed.toUpperCase();
  if (upper === "S" || upper === "I" || upper === "A")
    return { status: upper, value: null, key: upper };
  if (/^(blank|kosong|-)$/iu.test(trimmed)) return { status: "blank", value: null, key: "blank" };
  const value = parseGradeValue(trimmed);
  return value === null ? null : { status: "value", value, key: String(value) };
}

type PendingCell = {
  line: number;
  rowIndex: number;
  column: string;
  a: NormalizedCell | null;
  b: NormalizedCell | null;
  raw: string;
  reasons: Set<FlagReason>;
  bbox: Box | null;
};

const REREAD_REASONS: ReadonlySet<FlagReason> = new Set([
  "models_disagree",
  "self_unsure",
  "struck",
  "initial",
  "illegible",
  "out_of_range",
  "zero_or_blank",
  "outlier",
]);

function clamp(value: number): number {
  return Math.max(0, Math.min(1000, Math.round(value)));
}

export function cellBox(
  x: readonly [number, number] | null | undefined,
  y: readonly [number, number] | null | undefined,
  padding = 0.15,
): Box | null {
  if (!x || !y) return null;
  const width = x[1] - x[0];
  const height = y[1] - y[0];
  if (width <= 0 || height <= 0) return null;
  return [
    clamp(x[0] - width * padding),
    clamp(y[0] - height * padding),
    clamp(x[1] + width * padding),
    clamp(y[1] + height * padding),
  ];
}

function cellReasons(a: ModelCell | undefined, b: ModelCell | undefined): Set<FlagReason> {
  const reasons = new Set<FlagReason>();
  const na = normalizeModelCell(a);
  const nb = normalizeModelCell(b);
  if (!na || !nb || na.key !== nb.key) reasons.add("models_disagree");
  if (a?.unsure || b?.unsure) reasons.add("self_unsure");
  if (a?.struck || b?.struck) reasons.add("struck");
  if (a?.has_initial || b?.has_initial) reasons.add("initial");
  if (na?.status === "illegible" || nb?.status === "illegible") reasons.add("illegible");
  if (na?.status === "invalid" || nb?.status === "invalid") reasons.add("out_of_range");
  if (na?.value === 0 || nb?.value === 0) reasons.add("zero_or_blank");
  const agreedAbsence = na && nb && na.key === nb.key && ["S", "I", "A"].includes(na.status);
  if (agreedAbsence) reasons.add("absence");
  return reasons;
}

/** Flags values far from the rest of the column (|z| > 3), a sign of a misread digit. */
export function outlierLines(
  values: ReadonlyArray<{ line: number; value: number }>,
  threshold = 3,
): Set<number> {
  const flagged = new Set<number>();
  if (values.length < 8) return flagged;
  const mean = values.reduce((sum, item) => sum + item.value, 0) / values.length;
  const sd = Math.sqrt(
    values.reduce((sum, item) => sum + (item.value - mean) ** 2, 0) / values.length,
  );
  if (sd === 0) return flagged;
  for (const item of values) {
    if (Math.abs((item.value - mean) / sd) > threshold) flagged.add(item.line);
  }
  return flagged;
}

/** Chooses the column the command is about ("UTS"); falls back to the only or the last column. */
export function pickColumn(
  columns: ReadonlyArray<{ key: string; header_raw: string }>,
  assessment: string | null | undefined,
): string | null {
  if (!columns.length) return null;
  if (assessment) {
    const wanted = assessment.toLocaleLowerCase("id-ID").replace(/\s+/gu, "");
    const match = columns.find((column) =>
      column.header_raw.toLocaleLowerCase("id-ID").replace(/\s+/gu, "").includes(wanted),
    );
    if (match) return match.key;
  }
  return columns.at(-1)!.key;
}

function alignRows(a: readonly ModelRow[], b: readonly ModelRow[]): Array<ModelRow | undefined> {
  const byNumber = new Map(b.map((row) => [row.row, row]));
  const numbersUnique = byNumber.size === b.length;
  return a.map((row, index) => (numbersUnique ? byNumber.get(row.row) : b[index]));
}

export type CombineInput = {
  a: ModelReading;
  b: ModelReading;
  columnKey: string;
};

/** Pure: merges the two readings for one column and lists the cells that need a re-read. */
export function combineReadings({ a, b, columnKey }: CombineInput): PendingCell[] {
  const columnIndex = a.columns.findIndex((column) => column.key === columnKey);
  const bColumnKey = b.columns[columnIndex]?.key ?? columnKey;
  const columnX = a.columns[columnIndex]?.x ?? null;
  const bRows = alignRows(a.rows, b.rows);

  const pending = a.rows.map((row, rowIndex) => {
    const aCell = row.cells.find((cell) => cell.col === columnKey);
    const bCell = bRows[rowIndex]?.cells.find((cell) => cell.col === bColumnKey);
    return {
      line: row.row,
      rowIndex,
      column: columnKey,
      a: normalizeModelCell(aCell),
      b: normalizeModelCell(bCell),
      raw: aCell?.raw ?? "",
      reasons: cellReasons(aCell, bCell),
      bbox: cellBox(columnX, row.y),
    } satisfies PendingCell;
  });

  const accepted = pending
    .filter((cell) => cell.reasons.size === 0 && cell.a?.status === "value")
    .map((cell) => ({ line: cell.line, value: cell.a!.value! }));
  const outliers = outlierLines(accepted);
  for (const cell of pending) if (outliers.has(cell.line)) cell.reasons.add("outlier");
  return pending;
}

export function needsReread(cell: { reasons: ReadonlySet<FlagReason> }): boolean {
  return [...cell.reasons].some((reason) => REREAD_REASONS.has(reason));
}

/** Pure: final cell after the optional re-read. */
export function resolveCell(
  cell: PendingCell,
  reread: NormalizedCell | null | undefined,
): GradeCell {
  const reasons = new Set(cell.reasons);
  const readings = {
    a: cell.a?.key ?? null,
    b: cell.b?.key ?? null,
    reread: reread === undefined ? null : (reread?.key ?? "?"),
  };

  if (reasons.size === 0) {
    const agreed = cell.a!;
    return {
      column: cell.column,
      raw: cell.raw,
      value: agreed.value,
      status:
        agreed.status === "value"
          ? "value"
          : agreed.status === "blank"
            ? "blank"
            : (agreed.status as "S" | "I" | "A"),
      confidence: "high",
      reasons: [],
      readings,
      bbox: cell.bbox,
    };
  }

  if (!needsReread(cell)) {
    const agreed = cell.a!;
    return {
      column: cell.column,
      raw: cell.raw,
      value: null,
      status: agreed.status as "S" | "I" | "A",
      confidence: "medium",
      reasons: [...reasons],
      readings,
      bbox: cell.bbox,
    };
  }

  const candidates = [cell.a, cell.b].filter((item): item is NormalizedCell => !!item);
  const matchesReader = !!reread && candidates.some((item) => item.key === reread.key);
  if (reread && !matchesReader) reasons.add("reread_changed");
  const suggestion = reread ?? candidates.find((item) => item.status === "value") ?? null;
  const status =
    suggestion && ["S", "I", "A", "blank"].includes(suggestion.status)
      ? (suggestion.status as "S" | "I" | "A" | "blank")
      : "value";
  return {
    column: cell.column,
    raw: cell.raw,
    value: suggestion?.status === "value" ? suggestion.value : null,
    status,
    confidence: matchesReader ? "medium" : "low",
    reasons: [...reasons],
    readings,
    bbox: cell.bbox,
  };
}

export type ImageCropper = (box: Box) => Promise<LlmContent>;

export type ReadGradePhotoInput = {
  image: LlmContent;
  roster: readonly RosterStudent[];
  /** The assessment the teacher asked for ("UTS"); picks the column. */
  assessment?: string | null;
  /** Cuts a cell out of the photo; without it the re-read gets the whole photo plus cell positions. */
  cropImage?: ImageCropper;
};

export type ReadGradePhotoResult =
  | { status: "ok"; reading: GradeSheetReading }
  | { status: "reshoot"; issues: string[]; sentence: string };

const HINT =
  "Buku nilai satu kelas. Salin semua baris siswa dan semua kolom nilai persis seperti tertulis.";

export async function readGradePhoto(
  readers: GradeReaders,
  input: ReadGradePhotoInput,
): Promise<ReadGradePhotoResult> {
  const [a, b] = await Promise.all([
    readWithModel(readers.readA, READ_A_INSTRUCTIONS, input.image, HINT),
    readWithModel(readers.readB, READ_B_INSTRUCTIONS, input.image, HINT),
  ]);

  if (!a.page_quality.readable || !a.rows.length) {
    return {
      status: "reshoot",
      issues: a.page_quality.issues,
      sentence: "Fotonya belum terbaca jelas. Boleh difoto ulang, Bu?",
    };
  }

  const columnKey = pickColumn(a.columns, input.assessment);
  if (!columnKey) {
    return {
      status: "reshoot",
      issues: ["no_grade_column"],
      sentence: "Kolom nilainya belum terlihat. Boleh difoto ulang, Bu?",
    };
  }

  const pending = combineReadings({ a, b, columnKey });
  const header = a.columns.find((column) => column.key === columnKey)?.header_raw ?? columnKey;
  const toReread = pending.filter(needsReread);
  const rereads = new Map<string, string>();
  if (toReread.length) {
    const requests: RereadRequest[] = await Promise.all(
      toReread.map(async (cell) => {
        const name = a.rows[cell.rowIndex]?.name_raw ?? "";
        const position = cell.bbox
          ? ` (area x=${cell.bbox[0]}–${cell.bbox[2]}, y=${cell.bbox[1]}–${cell.bbox[3]} dari 1000)`
          : "";
        return {
          id: `${cell.line}`,
          description: `baris ${cell.line} (${name}), kolom ${header}${input.cropImage ? "" : position}`,
          image: input.cropImage && cell.bbox ? await input.cropImage(cell.bbox) : input.image,
        };
      }),
    );
    const results = await rereadCells(
      readers.reread,
      requests,
      input.cropImage ? undefined : input.image,
    );
    for (const [id, value] of results) rereads.set(id, value);
  }

  const bRows = alignRows(a.rows, b.rows);
  const matches = matchNames(
    a.rows.map((row, index) => ({
      line: row.row,
      nameRaw: row.name_raw,
      nameAlt: bRows[index]?.name_raw ?? null,
    })),
    input.roster,
  );

  const rows: GradeRow[] = pending.map((cell, index) => {
    const modelRow = a.rows[index]!;
    const match = matches[index]!;
    const reread = needsReread(cell)
      ? normalizeRereadValue(rereads.get(`${cell.line}`))
      : undefined;
    const firstColumnLeft = a.columns[0]?.x?.[0] ?? null;
    return {
      line: cell.line,
      nameRaw: modelRow.name_raw,
      studentId: match.studentId,
      rosterName: match.rosterName,
      nameScore: Math.round(match.score * 1000) / 1000,
      nameStatus: modelRow.name_struck && match.status === "auto" ? "ask" : match.status,
      candidates: match.candidates,
      nameBox: firstColumnLeft !== null ? cellBox([0, firstColumnLeft], modelRow.y, 0.05) : null,
      cells: [resolveCell(cell, reread)],
    };
  });

  const assigned = new Set(rows.map((row) => row.studentId).filter(Boolean));
  return {
    status: "ok",
    reading: {
      source: "photo",
      readable: true,
      issues: a.page_quality.issues,
      columns: a.columns.map((column) => ({ key: column.key, label: column.header_raw })),
      rows,
      unmatchedStudents: input.roster
        .filter((student) => !assigned.has(student.studentId))
        .map(({ studentId, name }) => ({ studentId, name })),
      skippedRows: 0,
    },
  };
}
