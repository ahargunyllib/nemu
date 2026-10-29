import assert from "node:assert/strict";
import test from "node:test";

import { chunkKnowledgeDocument } from "./demo-data-lib.mjs";

const activeDocument = {
  doc_id: "pmk-test",
  judul: "Peraturan uji",
  status: "aktif",
  berlaku_mulai: "2026-01-01",
};

test("carries an article across a page marker and splits each explicit ayat", () => {
  const chunks = chunkKnowledgeDocument(
    activeDocument,
    `Pasal 34

[Halaman 9]

(1) Pertanggungjawaban disampaikan paling lambat 5 (lima) hari kerja.
(2) Dokumen pertanggungjawaban harus lengkap.
Pasal 35
Ketentuan berikutnya tidak termasuk aturan tenggat.`,
  );

  const deadlineChunk = chunks.find((chunk) => chunk.article === "34 ayat (1)");

  assert.ok(deadlineChunk);
  assert.equal(deadlineChunk.page, 9);
  assert.match(deadlineChunk.text, /5 \(lima\) hari kerja/u);
  assert.doesNotMatch(deadlineChunk.text, /Pasal 35/u);
});

test("does not treat a legal cross-reference as an article heading", () => {
  const chunks = chunkKnowledgeDocument(
    activeDocument,
    `[Halaman 9]
Pasal 34
(1) Aturan utama.
sebagaimana dimaksud dalam Pasal 35 ayat (2), ketentuan ini tetap berlaku.`,
  );

  assert.equal(chunks.at(-1)?.article, "34 ayat (1)");
});

test("resets legal article metadata when an appendix begins", () => {
  const chunks = chunkKnowledgeDocument(
    activeDocument,
    `Pasal 5
Ketentuan penutup.
[Halaman 19]
LAMPIRAN I
TABEL STANDAR BIAYA`,
  );

  const appendixChunk = chunks.find((chunk) => chunk.page === 19);
  assert.ok(appendixChunk);
  assert.equal(appendixChunk.article, undefined);
});

test("does not reset legal metadata for an appendix reference inside an article", () => {
  const chunks = chunkKnowledgeDocument(
    activeDocument,
    `Pasal 8
(10) Format mengikuti ketentuan berikut:
Lampiran II yang merupakan bagian tidak terpisahkan dari peraturan ini.`,
  );

  assert.equal(chunks.at(-1)?.article, "8 ayat (10)");
});

test("never fabricates legal articles from application-guide headings", () => {
  const chunks = chunkKnowledgeDocument(
    { ...activeDocument, doc_id: "panduan-app", judul: "Panduan aplikasi" },
    `[Halaman 1]
## 5. Alur di aplikasi
Isi formulir lalu kirim permohonan.`,
  );

  assert.ok(chunks.length > 0);
  assert.ok(chunks.every((chunk) => chunk.article === undefined));
});
