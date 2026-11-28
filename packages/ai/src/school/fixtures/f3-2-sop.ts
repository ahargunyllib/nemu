/**
 * The F3-2 answers on the official SOP Penilaian, worded as the design's Gelembung Jawab (F3·09):
 * a short answer addressed to the teacher and the cited rule in one line under it, written from
 * `F3-2_pertanyaan-dan-kunci.csv`. The offline runtime answers the official questions with them so
 * `NEMU_RESPONDER=fixture` reads like the live model; the citation is still the real retrieval,
 * and every other question gets the cited sentence itself.
 */
const F3_2_ANSWERS: Record<string, (honorific: string) => { answer: string; detail: string }> = {
  "nilai di bawah berapa harus remedial": (who) => ({
    answer: `Di bawah 75, ${who}. Itu wajib remedial.`,
    detail: "KKM 75 berlaku untuk semua mapel.",
  }),
  "remedial boleh berapa kali, nilainya maksimal berapa": (who) => ({
    answer: `Paling banyak 2 kali, ${who}. Nilainya paling tinggi 75.`,
    detail: "Berlaku untuk setiap penilaian.",
  }),
  "nilai uts paling lambat dimasukkan kapan": (who) => ({
    answer: `Paling lambat 7 hari kerja, ${who}.`,
    detail: "Dihitung sejak ulangan selesai.",
  }),
  "anak yang tidak ikut ulangan diberi nilai berapa": (who) => ({
    answer: `Jangan diberi 0, ${who}. Kolom nilainya dikosongkan.`,
    detail: "Tulis keterangan “tidak hadir”. Susulan paling lambat 14 hari.",
  }),
};

/** The design's answer for an official F3-2 question, or null for any other question. */
export function f32Answer(
  question: string,
  honorific: string,
): { answer: string; detail: string } | null {
  const key = question
    .trim()
    .toLocaleLowerCase("id-ID")
    .replace(/[?.!\s]+$/u, "");
  return F3_2_ANSWERS[key]?.(honorific) ?? null;
}
