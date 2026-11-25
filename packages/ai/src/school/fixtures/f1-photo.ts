import type { ModelCell, ModelReading } from "../grades/vision.js";
import { CLASS_4B } from "./sdit-nusantara.js";

/**
 * A synthetic grade-book page shaped like data-uji F1-1: 32 lines, 4 doubtful digits, 5 names
 * spelled differently, one S, and 13 values under KKM 75 once the teacher has answered.
 * Used by tests and by the offline (fixture) school AI.
 */
export const F1_FINAL_VALUES: Array<number | "S"> = [
  82,
  74,
  86,
  58,
  77,
  91,
  61,
  70,
  95,
  71,
  80,
  81,
  90,
  65,
  78,
  73,
  84,
  69,
  88,
  72,
  "S",
  93,
  60,
  76,
  68,
  79,
  74,
  87,
  55,
  83,
  75,
  97,
];

export const F1_WRITTEN_NAMES: Record<number, string> = {
  2: "Alisa Zahra",
  11: "Gita Ramadani",
  16: "Laila Khairunisa",
  17: "M. Rizky Pratama",
  23: "Reza Firmansah",
  30: "Vania Maharany",
};

/** Lines whose digit is doubtful, and what a careful re-read finds. */
export const F1_REREAD: Record<string, string> = { "3": "86", "7": "61", "10": "71", "15": "78" };

export function modelCell(value: number | "S", extra: Partial<ModelCell> = {}): ModelCell {
  const base: ModelCell =
    value === "S"
      ? {
          col: "c1",
          raw: "S",
          kind: "absence",
          value: null,
          absence: "S",
          struck: false,
          replaced_by: null,
          has_initial: false,
          unsure: false,
          alternatives: [],
        }
      : {
          col: "c1",
          raw: String(value),
          kind: "number",
          value: String(value),
          absence: null,
          struck: false,
          replaced_by: null,
          has_initial: false,
          unsure: false,
          alternatives: [],
        };
  return { ...base, ...extra };
}

export function f1Page(
  withCoordinates: boolean,
  overrides: Record<number, Partial<ModelCell>> = {},
): ModelReading {
  return {
    page_quality: { readable: true, issues: [] },
    columns: [{ key: "c1", header_raw: "UTS", x: withCoordinates ? [600, 700] : null }],
    rows: F1_FINAL_VALUES.map((value, index) => {
      const line = index + 1;
      return {
        row: line,
        y: withCoordinates ? [100 + index * 25, 120 + index * 25] : null,
        name_raw: F1_WRITTEN_NAMES[line] ?? CLASS_4B[index]!.name,
        name_struck: false,
        cells: [modelCell(value, overrides[line])],
      };
    }),
  };
}

/** Read A: coordinates, and the four doubtful cells as a first reader would see them. */
export const F1_READ_A = f1Page(true, {
  3: { value: "88", raw: "88" },
  7: { unsure: true, alternatives: ["61", "67"] },
  10: { value: "77", raw: "77", unsure: true, alternatives: ["77", "71"] },
  15: { struck: true, replaced_by: "78", value: "70", raw: "70→78" },
});

/** Read B: an independent reader that gets every cell as written. */
export const F1_READ_B = f1Page(false);
