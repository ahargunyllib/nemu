import { z } from "zod";

import type { JsonCall, LlmContent } from "../llm.js";

/** One cell as a vision model reports it, before any checks. */
export type ModelCell = {
  col: string;
  raw: string;
  kind: "number" | "absence" | "blank" | "illegible";
  value: string | null;
  absence: "S" | "I" | "A" | null;
  struck: boolean;
  replaced_by: string | null;
  has_initial: boolean;
  unsure: boolean;
  alternatives: string[];
};

export type ModelRow = {
  row: number;
  y: [number, number] | null;
  name_raw: string;
  name_struck: boolean;
  cells: ModelCell[];
};

export type ModelReading = {
  page_quality: { readable: boolean; issues: string[] };
  columns: Array<{ key: string; header_raw: string; x: [number, number] | null }>;
  rows: ModelRow[];
};

const range = z.tuple([z.number(), z.number()]).nullable();

const modelReadingSchema = z.object({
  page_quality: z.object({ readable: z.boolean(), issues: z.array(z.string()) }),
  columns: z.array(z.object({ key: z.string(), header_raw: z.string(), x: range })),
  rows: z.array(
    z.object({
      row: z.number().int(),
      y: range,
      name_raw: z.string(),
      name_struck: z.boolean(),
      cells: z.array(
        z.object({
          col: z.string(),
          raw: z.string(),
          kind: z.enum(["number", "absence", "blank", "illegible"]),
          value: z.string().nullable(),
          absence: z.enum(["S", "I", "A"]).nullable(),
          struck: z.boolean(),
          replaced_by: z.string().nullable(),
          has_initial: z.boolean(),
          unsure: z.boolean(),
          alternatives: z.array(z.string()),
        }),
      ),
    }),
  ),
});

const nullableRange = {
  anyOf: [{ type: "array", items: { type: "number" }, minItems: 2, maxItems: 2 }, { type: "null" }],
};

export const MODEL_READING_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["page_quality", "columns", "rows"],
  properties: {
    page_quality: {
      type: "object",
      additionalProperties: false,
      required: ["readable", "issues"],
      properties: {
        readable: { type: "boolean" },
        issues: { type: "array", items: { type: "string" } },
      },
    },
    columns: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["key", "header_raw", "x"],
        properties: { key: { type: "string" }, header_raw: { type: "string" }, x: nullableRange },
      },
    },
    rows: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["row", "y", "name_raw", "name_struck", "cells"],
        properties: {
          row: { type: "integer" },
          y: nullableRange,
          name_raw: { type: "string" },
          name_struck: { type: "boolean" },
          cells: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: [
                "col",
                "raw",
                "kind",
                "value",
                "absence",
                "struck",
                "replaced_by",
                "has_initial",
                "unsure",
                "alternatives",
              ],
              properties: {
                col: { type: "string" },
                raw: { type: "string" },
                kind: { type: "string", enum: ["number", "absence", "blank", "illegible"] },
                value: { type: ["string", "null"] },
                absence: { type: ["string", "null"], enum: ["S", "I", "A", null] },
                struck: { type: "boolean" },
                replaced_by: { type: ["string", "null"] },
                has_initial: { type: "boolean" },
                unsure: { type: "boolean" },
                alternatives: { type: "array", items: { type: "string" } },
              },
            },
          },
        },
      },
    },
  },
} as const;

const SHARED_RULES = `
- Copy exactly what is written. Never correct a spelling, never guess a likely name, never round.
- An empty cell is kind "blank" with value null. Never write 0 for an empty cell.
- S, I, A (sakit, izin, alpa) are kind "absence" with absence set and value null.
- A crossed-out value: struck=true; if a new value is written next to it, put it in replaced_by.
- A small initial or paraf in the cell: has_initial=true.
- If any digit could be read two ways, unsure=true and list both readings in alternatives (most likely first).
- Handwritten 1 and 7, 4 and 9, 3 and 8, 6 and 0 are easy to confuse. Compare each digit with how the same writer forms that digit in other rows; a digit shaped differently from the writer's usual one is unsure.
- If a digit is smudged, faded or covered, do not guess it: unsure=true, or kind "illegible" if no reading is possible.
- If a cell cannot be read at all, kind "illegible".
- Number columns left to right as c1, c2, … and keep the same keys in every row.
- row is the line number on the page, starting at 1 for the first student line. Skip header, title and total/average lines.
- If the page is too blurry, cut off or dark to read, set page_quality.readable=false and list the issues.`;

export const READ_A_INSTRUCTIONS = `You transcribe a photographed Indonesian teacher's grade book (buku nilai) into JSON.
Return every student line with the raw name and every grade cell.
Coordinates: for each column give x=[left,right] and for each row y=[top,bottom] on a 0–1000 scale of the whole image (0,0 is the top-left corner).
${SHARED_RULES}`;

export const READ_B_INSTRUCTIONS = `Read this photo of a handwritten Indonesian class grade list and transcribe it literally into JSON.
Set every x and y to null. Do not fix names or numbers to what seems likely; report what the ink shows.
${SHARED_RULES}`;

export type GradeReaders = {
  /** Structure + coordinates (Read A). */
  readA: JsonCall;
  /** Independent model family (Read B). */
  readB: JsonCall;
  /** Crop re-read; the stronger model. */
  reread: JsonCall;
};

export async function readWithModel(
  call: JsonCall,
  instructions: string,
  image: LlmContent,
  hint: string,
): Promise<ModelReading> {
  return call({
    instructions,
    content: [{ type: "text", text: hint }, image],
    schemaName: "grade_book_reading",
    schema: MODEL_READING_JSON_SCHEMA,
    parse: (value) => modelReadingSchema.parse(value) as ModelReading,
    maxOutputTokens: 8_000,
  });
}

export type RereadRequest = { id: string; description: string; image: LlmContent };

const rereadSchema = z.object({
  cells: z.array(z.object({ id: z.string(), strokes: z.string().optional(), value: z.string() })),
});

const REREAD_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["cells"],
  properties: {
    cells: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "strokes", "value"],
        properties: {
          id: { type: "string" },
          strokes: { type: "string" },
          value: { type: "string" },
        },
      },
    },
  },
} as const;

const REREAD_INSTRUCTIONS = `You check doubtful handwritten cells from an Indonesian grade book, one id at a time.
Each id says what earlier readers saw there; they may be wrong, so look at the ink yourself.
Compare every digit with how the same writer forms that digit in other rows of the column: a 1 can carry a long hook or flag and still be a 1 if its stem is upright, unlike the writer's 7s; a closed 9 can look like a 4.
If a value is crossed out and another written beside it, answer the new one.
First describe in strokes the ink of each digit (e.g. "slanted stem, flat top" or "upright stem, hooked flag"), and how it compares with the writer's other digits; then give the value.
Answer exactly what is written: digits (e.g. "77"), "S", "I", "A", "blank" if empty, or "?" if any digit is smudged, covered or still unclear.
Do not guess. "?" is better than a wrong number.`;

/**
 * Re-reads up to 12 cells per call; returns id → value ("?" when unsure). With `sharedImage`, the
 * cells are described by position on that one image instead of sending a crop each.
 */
export async function rereadCells(
  call: JsonCall,
  requests: readonly RereadRequest[],
  sharedImage?: LlmContent,
): Promise<Map<string, string>> {
  const results = new Map<string, string>();
  for (let start = 0; start < requests.length; start += 12) {
    const batch = requests.slice(start, start + 12);
    const content: LlmContent[] = [];
    if (sharedImage) {
      content.push({
        type: "text",
        text: `The image is the whole page. Read only these cells:\n${batch
          .map((request) => `id=${request.id}: ${request.description}`)
          .join("\n")}`,
      });
      content.push(sharedImage);
    } else {
      for (const request of batch) {
        content.push({ type: "text", text: `id=${request.id}: ${request.description}` });
        content.push(request.image);
      }
    }
    const response = await call({
      instructions: REREAD_INSTRUCTIONS,
      content,
      schemaName: "cell_reread",
      schema: REREAD_JSON_SCHEMA,
      parse: (value) => rereadSchema.parse(value),
      // Reasoning tokens count against this too; a short budget cuts the JSON off.
      maxOutputTokens: 6_000,
    });
    for (const cell of response.cells) results.set(cell.id, cell.value.trim());
  }
  return results;
}
