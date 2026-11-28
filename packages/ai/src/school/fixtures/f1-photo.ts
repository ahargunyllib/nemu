import type { PhotoTitleCandidate } from "@nemu/contracts/school";

import type { ModelCell, ModelReading } from "../grades/vision.js";
import type { RosterStudent } from "../names.js";

/**
 * The official data-uji F1-1 page (`f1-1-buku-nilai-4b.jpg`, key `F1-1_kunci-jawaban.csv`): 32
 * lines in the book's order, names as written, the true values. Used by tests and by the offline
 * (fixture) school AI, which reads every photo as this page.
 */
export const F1_BOOK: ReadonlyArray<{ name: string; rosterName?: string; value: number | "S" }> = [
  { name: "Ahmad Fadli", value: 62 },
  { name: "Aisyah Zahra", value: 82 },
  { name: "Alya Nur Fitri", value: 90 },
  { name: "Bagas Saputra", value: 68 },
  { name: "Budi Santoso", value: 77 },
  { name: "Citra Ayu Lestari", value: 64 },
  { name: "Dimas Pratama", value: 85 },
  { name: "Dinda Maharani", value: 87 },
  { name: "Fahri Hidayat", value: 73 },
  { name: "Farah Annisa", value: 71 },
  { name: "Galih Ramadhan", value: 69 },
  { name: "Ilham Maulana", value: 90 },
  { name: "Hana Salsabila", value: 81 },
  { name: "Intan Permata", value: 65 },
  { name: "Kevin Ardiansyah", value: 72 },
  { name: "Laila N.A.", rosterName: "Laila Nur Azizah", value: 64 },
  { name: "M. Rizki", rosterName: "Muhammad Rizky", value: 63 },
  { name: "Nabila", rosterName: "Nabila Putri Ramadhani", value: 80 },
  { name: "Naufal Akbar", value: 73 },
  { name: "Nur Aini", value: 83 },
  { name: "Putra Wijaya", value: 77 },
  { name: "Qonita Rahma", value: 79 },
  { name: "Raka Aditya", value: "S" },
  { name: "Rani Oktaviani", value: 82 },
  { name: "Salsabila Putri", value: 77 },
  { name: "Siti Nurhaliza", rosterName: "Siti Nur Haliza", value: 85 },
  { name: "Taufik H.", rosterName: "Taufik Hidayatullah", value: 85 },
  { name: "Tiara Anjani", value: 94 },
  { name: "Umar Faruq", value: 64 },
  { name: "Vina Amelia", value: 63 },
  { name: "Yusuf Alfarizi", value: 82 },
  { name: "Zahra Khairunnisa", value: 90 },
];

/** The value on each line of the page, after the teacher has answered. */
export const F1_FINAL_VALUES: Array<number | "S"> = F1_BOOK.map((line) => line.value);

/** 4B as 01_profil-sekolah lists it (WS-06 and the mock AlurSekolah), ids as WS-06 seeds them. */
export const F1_ROSTER: RosterStudent[] = [
  "Ahmad Fadli",
  "Aisyah Zahra",
  "Alya Nur Fitri",
  "Bagas Saputra",
  "Budi Santoso",
  "Citra Ayu Lestari",
  "Dimas Pratama",
  "Dinda Maharani",
  "Fahri Hidayat",
  "Farah Annisa",
  "Galih Ramadhan",
  "Hana Salsabila",
  "Ilham Maulana",
  "Intan Permata",
  "Kevin Ardiansyah",
  "Laila Nur Azizah",
  "Muhammad Rizky",
  "Nabila Putri Ramadhani",
  "Naufal Akbar",
  "Nur Aini",
  "Putra Wijaya",
  "Qonita Rahma",
  "Raka Aditya",
  "Rani Oktaviani",
  "Salsabila Putri",
  "Siti Nur Haliza",
  "Taufik Hidayatullah",
  "Tiara Anjani",
  "Umar Faruq",
  "Vina Amelia",
  "Yusuf Alfarizi",
  "Zahra Khairunnisa",
].map((name, index) => ({
  studentId: `4b-${String(index + 1).padStart(2, "0")}`,
  name,
  number: index + 1,
}));

/** Lines whose digit is doubtful, and what a careful re-read finds ("?" for the smudged 83). */
export const F1_REREAD: Record<string, string> = { "7": "85", "10": "71", "20": "?", "28": "94" };

export function modelCell(value: number | "S", extra: Partial<ModelCell> = {}): ModelCell {
  const base: ModelCell =
    value === "S"
      ? {
          col: "c1",
          raw: "S (sakit)",
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

/** Where line n sits on the photo, 0–1000: the ruled lines are about 22.5 units apart. */
function lineY(line: number): [number, number] {
  const middle = Math.round((335 + 43.2 * (line - 1)) / 1.92);
  return [middle - 12, middle + 12];
}

/** The page as a reader returns it, with the value column where the photo has it. */
export function f1Page(
  withCoordinates: boolean,
  overrides: Record<number, Partial<ModelCell>> = {},
): ModelReading {
  return {
    page_quality: { readable: true, issues: [] },
    columns: [{ key: "c1", header_raw: "Nilai", x: withCoordinates ? [630, 790] : null }],
    rows: F1_BOOK.map((written, index) => {
      const line = index + 1;
      return {
        row: line,
        y: withCoordinates ? lineY(line) : null,
        name_raw: written.name,
        name_struck: false,
        cells: [modelCell(written.value, overrides[line])],
      };
    }),
  };
}

/** What both readers see on the four doubtful cells: the struck 65, and the smudged digit. */
const F1_HARD: Record<number, Partial<ModelCell>> = {
  7: { value: "65", raw: "65 → 85 (paraf)", struck: true, replaced_by: "85", has_initial: true },
  20: { kind: "illegible", value: null, raw: "8?" },
};

/** The four doubtful cells as a first reader sees them (Read A). */
export const F1_DOUBTFUL: Record<number, Partial<ModelCell>> = {
  ...F1_HARD,
  10: { value: "77", raw: "77", unsure: true, alternatives: ["77", "71"] },
  28: { value: "44", raw: "44", unsure: true, alternatives: ["44", "94"] },
};

/** Read A: coordinates, and the four doubtful cells as a first reader would see them. */
export const F1_READ_A = f1Page(true, F1_DOUBTFUL);

/** The official page's heading, "Daftar Nilai UTS Matematika - Kelas 4B", read for #269. */
export const F1_TITLE: PhotoTitleCandidate[] = [
  { assessment: "UTS", subject: "Matematika", className: "4B" },
];

/** Read B: an independent reader that gets the rest of the page as written. */
export const F1_READ_B = f1Page(false, F1_HARD);
