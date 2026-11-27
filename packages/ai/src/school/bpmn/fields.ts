import type { JsonCall } from "../llm.js";
import { normalizeControlName } from "../safety.js";

/**
 * F3-17: a BPMN form field → the label the page shows for it, so the executor finds the field by
 * label on any school's page ("Tanggal setoran" in the BPMN may read "Tanggal" on the page). Code
 * matches what it can tell for sure; only what is left goes to the model, which may say none.
 */

/** One of `values` or null; `anyOf`, since some providers reject an enum under a type list. */
export function nullableEnum(values: readonly string[]): Record<string, unknown> {
  return { anyOf: [{ type: "string", enum: [...values] }, { type: "null" }] };
}

export type FieldToMatch = { id: string; label: string };
export type FieldMatch = Record<string, string | null>;

function words(text: string): Set<string> {
  return new Set(normalizeControlName(text).split(" ").filter(Boolean));
}

function overlap(a: Set<string>, b: Set<string>): number {
  let shared = 0;
  for (const word of a) if (b.has(word)) shared += 1;
  return shared / Math.max(1, Math.min(a.size, b.size));
}

/**
 * Pure: exact (normalized) label first, then a label whose words contain the other's, then the
 * best word overlap of at least half. Each page label goes to one field only; a tie is no match.
 */
export function matchFieldLabels(
  fields: readonly FieldToMatch[],
  pageLabels: readonly string[],
): FieldMatch {
  const result: FieldMatch = Object.fromEntries(fields.map((field) => [field.id, null]));
  const free = new Set(pageLabels.filter((label) => normalizeControlName(label)));
  const take = (field: FieldToMatch, label: string) => {
    result[field.id] = label;
    free.delete(label);
  };
  const passes: Array<(field: FieldToMatch, label: string) => number> = [
    (field, label) => (normalizeControlName(field.label) === normalizeControlName(label) ? 1 : 0),
    (field, label) => {
      const a = ` ${normalizeControlName(field.label)} `;
      const b = ` ${normalizeControlName(label)} `;
      return a.includes(b) || b.includes(a) ? 1 : 0;
    },
    (field, label) => {
      const score = overlap(words(field.label), words(label));
      return score >= 0.5 ? score : 0;
    },
  ];
  for (const score of passes) {
    for (const field of fields) {
      if (result[field.id]) continue;
      const ranked = [...free]
        .map((label) => ({ label, score: score(field, label) }))
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score);
      const [best, second] = ranked;
      if (best && (!second || second.score < best.score)) take(field, best.label);
    }
  }
  return result;
}

export async function matchFields(
  deps: { llm?: JsonCall },
  input: { fields: readonly FieldToMatch[]; pageLabels: readonly string[] },
): Promise<FieldMatch> {
  const result = matchFieldLabels(input.fields, input.pageLabels);
  const left = input.fields.filter((field) => !result[field.id]);
  const used = new Set(Object.values(result).filter((label): label is string => !!label));
  const labels = input.pageLabels.filter((label) => !used.has(label));
  if (!deps.llm || !left.length || !labels.length) return result;
  try {
    const answer = await deps.llm<{ matches: Array<{ field: string; label: string | null }> }>({
      instructions: `Cocokkan setiap isian formulir proses sekolah dengan label isian di halaman yang artinya sama.
Pakai hanya label dari daftar. Kalau tidak ada yang artinya sama, label null. Satu label untuk satu isian.`,
      content: [
        {
          type: "text",
          text: JSON.stringify({
            isian: left.map((field) => ({ id: field.id, label: field.label })),
            label_halaman: labels,
          }),
        },
      ],
      schemaName: "field_labels",
      schema: {
        type: "object",
        additionalProperties: false,
        required: ["matches"],
        properties: {
          matches: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["field", "label"],
              properties: {
                field: { type: "string", enum: left.map((field) => field.id) },
                label: nullableEnum(labels),
              },
            },
          },
        },
      },
      parse: (value) => value as { matches: Array<{ field: string; label: string | null }> },
      maxOutputTokens: 600,
    });
    for (const match of answer.matches) {
      if (!(match.field in result) || result[match.field] || !match.label) continue;
      if (!labels.includes(match.label) || used.has(match.label)) continue;
      result[match.field] = match.label;
      used.add(match.label);
    }
  } catch (error) {
    // The code's matches stand; an unmatched field is found by its own label or left to the teacher.
    console.error("Matching form fields to page labels failed", error);
  }
  return result;
}
