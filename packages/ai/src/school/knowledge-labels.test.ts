import assert from "node:assert/strict";
import test from "node:test";

import { retrieveKnowledge, type KnowledgeChunk } from "../knowledge.js";

const point = (article: string, text: string): KnowledgeChunk => ({
  id: article,
  docId: "sop-tahfidz",
  title: "SOP Tahfidz",
  version: "2026",
  article,
  page: 1,
  active: true,
  text,
});

test("an article label's structural words don't count as the chunk mentioning them", () => {
  const chunks = [
    point(
      "3 ayat 3.2",
      "3.2 Setiap setoran paling sedikit 3 ayat. Surah yang kurang dari 3 ayat disetorkan utuh.",
    ),
    point(
      "3 ayat 3.3",
      "3.3 Setoran dicatat di buku setoran pada saat menyimak, lalu dimasukkan ke AlurSekolah (menu Al-Quran › Tahfidz › Setoran baru) pada hari yang sama.",
    ),
    point(
      "3 ayat 3.4",
      "3.4 Murid yang tidak setor pada hari itu dibiarkan kosong, tidak diberi skor 0.",
    ),
  ];
  assert.equal(
    retrieveKnowledge(chunks, "Setoran minimal berapa ayat?", 1)[0]?.article,
    "3 ayat 3.2",
  );
});
