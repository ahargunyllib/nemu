// Chunks that answer each official grounded question in data/04_evaluasi/pertanyaan_uji.json,
// labelled from its `kutipan_wajib_salah_satu`. Retrieving any one of them counts as a hit.
export const RETRIEVAL_GOLD_CHUNKS = {
  Q01: ["sop-pd-01-section-4", "panduan-app-section-2"],
  Q02: ["pmk-119-2023-page-6-pasal-8-ayat-5", "pmk-32-2025-page-19", "sop-pd-01-section-4"],
  Q03: ["pmk-32-2025-page-15"],
  Q04: ["pmk-32-2025-page-19"],
  Q05: ["pmk-113-2012-page-9-pasal-34-ayat-1", "sop-pd-01-section-4"],
  Q06: ["pmk-113-2012-page-9-pasal-34-ayat-2", "sop-pd-01-section-4"],
  Q07: ["pmk-113-2012-page-9-pasal-34-ayat-3", "pmk-119-2023-page-11-pasal-36d"],
  Q08: ["pmk-119-2023-page-10-pasal-36c"],
  Q09: ["pmk-119-2023-page-9-pasal-36c", "sop-pd-01-section-4"],
  Q10: [
    "pmk-113-2012-page-6-pasal-27",
    "pmk-113-2012-page-6-pasal-27-ayat-1",
    "pmk-113-2012-page-8-pasal-27-ayat-2",
    "sop-pd-01-section-4",
  ],
  Q11: ["pmk-113-2012-page-6-pasal-25-ayat-2"],
  Q12: [
    "pmk-113-2012-page-8-pasal-33",
    "pmk-113-2012-page-8-pasal-33-ayat-1",
    "pmk-113-2012-page-8-pasal-33-ayat-2",
    "pmk-113-2012-page-8-pasal-33-ayat-3",
    "sop-pd-01-section-4",
  ],
  Q13: [
    "pmk-113-2012-page-2-pasal-4-ayat-1",
    "pmk-113-2012-page-2-pasal-4-ayat-3",
    "pmk-32-2025-page-15",
  ],
  Q14: ["pmk-119-2023-page-5-pasal-8-ayat-3", "pmk-119-2023-page-5-pasal-8-ayat-3a"],
  Q15: [
    "pmk-119-2023-page-5-pasal-8-ayat-3b",
    "pmk-119-2023-page-6-pasal-8-ayat-3b",
    "pmk-119-2023-page-9-pasal-36c",
  ],
  Q16: ["pmk-32-2025-document", "pmk-32-2025-page-1"],
  Q17: ["sop-pd-01-section-3", "sop-pd-01-section-5"],
  Q18: ["pmk-32-2025-page-86", "sop-pd-01-section-4"],
  Q19: ["pmk-32-2025-page-19", "sop-pd-01-section-4"],
  Q20: ["pmk-113-2012-page-9-pasal-34-ayat-2", "pmk-113-2012-page-9-pasal-34-ayat-3"],
};

// The keyword retriever's scores when this evaluation was added. A retrieval change must not
// drop below them; raise them when a change improves retrieval.
export const RETRIEVAL_FLOOR = { hit_at_5: 1, mrr: 0.7 };

const round = (value) => Math.round(value * 1000) / 1000;

/** Scores `retrieve(question)` against the gold chunks by hit rate at 1/3/5 and mean reciprocal rank. */
export function evaluateRetrieval(questions, gold, retrieve) {
  const results = questions.map((question) => {
    const expected = gold[question.id];
    if (!expected) throw new Error(`No gold chunks for ${question.id}`);

    const retrieved = retrieve(question.pertanyaan).map((chunk) => chunk.id);
    const rank = retrieved.findIndex((id) => expected.includes(id)) + 1;
    return { id: question.id, rank: rank || null, retrieved };
  });

  const hitRate = (k) =>
    round(results.filter((r) => r.rank && r.rank <= k).length / results.length);
  return {
    total_count: results.length,
    hit_at_1: hitRate(1),
    hit_at_3: hitRate(3),
    hit_at_5: hitRate(5),
    mrr: round(results.reduce((sum, r) => sum + (r.rank ? 1 / r.rank : 0), 0) / results.length),
    results,
  };
}
