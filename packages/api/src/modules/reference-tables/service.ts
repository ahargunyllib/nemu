import type { ReferenceTableRow, ReferenceTableValue } from "@nemu/db/schema/reference-tables";

import { parseCsv } from "./csv";
import type { ReferenceTableRecord, ReferenceTableRepository } from "./repository";
import {
  REFERENCE_TABLE_TYPES,
  REFERENCE_TABLES,
  type ReferenceTableDefinition,
  type ReferenceTableType,
  type TableColumn,
} from "./table-types";

export type ReferenceTableDeps = {
  tables: ReferenceTableRepository;
};

export type ParsedReferenceTable = {
  type: ReferenceTableType;
  columns: string[];
  rows: ReferenceTableRow[];
};

export type ParseResult = { ok: true; table: ParsedReferenceTable } | { ok: false; reason: string };

const DEFINITIONS = REFERENCE_TABLE_TYPES.map((type) => ({ type, ...REFERENCE_TABLES[type] }));

// Recognises which Reference Table a CSV is from its header, then checks every value
// against that table's column kinds. The first problem found is the rejection reason.
export function parseReferenceTableCsv(fileName: string, text: string): ParseResult {
  const [header, ...records] = parseCsv(text);
  if (!header) return { ok: false, reason: "The file is empty." };

  const headerNames = header.map((name) => name.trim());
  const recognised = DEFINITIONS.find((definition) =>
    definition.columns.every((column) => headerNames.includes(column.name)),
  );
  if (!recognised) return { ok: false, reason: unrecognisedReason(fileName, headerNames) };

  if (records.length === 0) {
    return { ok: false, reason: `The file has a ${recognised.label} header but no rows.` };
  }

  const rows: ReferenceTableRow[] = [];
  for (const [index, record] of records.entries()) {
    const line = index + 2;
    if (record.length !== headerNames.length) {
      return {
        ok: false,
        reason: `Line ${line} has ${record.length} values, but the header has ${headerNames.length} columns.`,
      };
    }

    const row: ReferenceTableRow = {};
    for (const column of recognised.columns) {
      const raw = record[headerNames.indexOf(column.name)]?.trim() ?? "";
      const value = parseValue(column, raw);
      if (value === null) {
        return {
          ok: false,
          reason: `Line ${line}, column "${column.name}": expected ${expectation(column)}, got ${raw ? `"${raw}"` : "an empty value"}.`,
        };
      }
      row[column.name] = value;
    }
    rows.push(row);
  }

  return {
    ok: true,
    table: {
      type: recognised.type,
      columns: recognised.columns.map((column) => column.name),
      rows,
    },
  };
}

function unrecognisedReason(fileName: string, headerNames: string[]) {
  const stem = fileName.replace(/\.csv$/i, "");
  const closest =
    DEFINITIONS.find((definition) => stem.startsWith(definition.type)) ??
    DEFINITIONS.map((definition) => ({
      definition,
      overlap: definition.columns.filter((column) => headerNames.includes(column.name)).length,
    }))
      .filter(({ overlap }) => overlap > 0)
      .sort((a, b) => b.overlap - a.overlap)[0]?.definition;

  if (!closest) {
    return `Unrecognised table. Expected the columns of one of: ${DEFINITIONS.map((d) => d.label).join(", ")}.`;
  }
  const missing = closest.columns
    .filter((column) => !headerNames.includes(column.name))
    .map((column) => column.name);
  return `Missing columns for ${closest.label}: ${missing.join(", ")}.`;
}

function parseValue(column: TableColumn, raw: string): ReferenceTableValue | null {
  switch (column.kind) {
    case "integer":
      return /^\d+$/.test(raw) ? Number(raw) : null;
    case "text":
      return raw === "" ? null : raw;
    case "date":
      return isIsoDate(raw) ? raw : null;
    case "enum":
      return column.values.includes(raw) ? raw : null;
  }
}

function isIsoDate(raw: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return false;
  const date = new Date(`${raw}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(raw);
}

function expectation(column: TableColumn) {
  switch (column.kind) {
    case "integer":
      return "a whole number";
    case "text":
      return "a value";
    case "date":
      return "a date as YYYY-MM-DD";
    case "enum":
      return `one of ${column.values.join(", ")}`;
  }
}

export type UploadResult =
  | { ok: true; table: ReferenceTableRecord }
  | { ok: false; reason: string };

// Replaces the stored rows of the table type the CSV is recognised as.
export async function uploadReferenceTable(
  { tables }: ReferenceTableDeps,
  file: File,
): Promise<UploadResult> {
  const parsed = parseReferenceTableCsv(file.name, await file.text());
  if (!parsed.ok) return parsed;

  const table = await tables.upsert({
    ...parsed.table,
    fileName: file.name,
    rowCount: parsed.table.rows.length,
  });
  return { ok: true, table };
}

export type ReferenceTableSummary = Pick<ReferenceTableDefinition, "label" | "description"> & {
  type: ReferenceTableType;
  columns: string[];
  stored: { fileName: string; rowCount: number; updatedAt: Date } | null;
};

// Every table type, with what is stored for it (null until the first upload or seed).
export async function listReferenceTables({
  tables,
}: ReferenceTableDeps): Promise<ReferenceTableSummary[]> {
  const stored = new Map((await tables.listSummaries()).map((row) => [row.type, row]));
  return DEFINITIONS.map(({ type, label, description, columns }) => {
    const row = stored.get(type);
    return {
      type,
      label,
      description,
      columns: columns.map((column) => column.name),
      stored: row
        ? { fileName: row.fileName, rowCount: row.rowCount, updatedAt: row.updatedAt }
        : null,
    };
  });
}

// How the server reads a table's rows back, e.g. for SBM lookups or deadline counting.
export function readReferenceTable({ tables }: ReferenceTableDeps, type: ReferenceTableType) {
  return tables.findByType(type);
}
