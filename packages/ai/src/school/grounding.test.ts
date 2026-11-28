import assert from "node:assert/strict";
import test from "node:test";

import { SOP_CHUNKS } from "./fixtures/sdit-nusantara.js";
import { answerGrounded, quoteIsInChunk } from "./grounding.js";
import { fakeJsonCall } from "./test-helpers.js";

test("an answer keeps only citations whose quote is really in the active chunk", async () => {
  const llm = fakeJsonCall({
    grounded_answer: {
      status: "answered",
      answer: "KKM di sekolah ini 75, Bu.",
      citations: [
        {
          chunk_id: "sop-p2-3-2",
          quote: "Kriteria Ketuntasan Minimal (KKM) untuk seluruh mata pelajaran adalah 75",
        },
        { chunk_id: "sop-p2-3-3", quote: "KKM boleh diturunkan oleh guru" },
      ],
    },
  });
  const result = await answerGrounded({ llm }, { question: "KKM berapa?", chunks: SOP_CHUNKS });
  assert.equal(result.status, "answered");
  if (result.status !== "answered") return;
  assert.deepEqual(
    result.citations.map((citation) => [citation.docId, citation.page, citation.article]),
    [["sop-penilaian-sdit-nusantara", 2, "3.2"]],
  );
});

test("the cited rule's short line comes back as the answer's detail (F3·09)", async () => {
  const llm = fakeJsonCall({
    grounded_answer: {
      status: "answered",
      answer: "Di bawah 75, Bu. Itu wajib remedial.",
      aturan: "KKM 75 berlaku untuk semua mapel.",
      citations: [{ chunk_id: "sop-p2-3-2", quote: "nilai di bawah 75 wajib mengikuti remedial" }],
    },
  });
  const result = await answerGrounded(
    { llm },
    { question: "Nilai di bawah berapa harus remedial?", chunks: SOP_CHUNKS, honorific: "Bu" },
  );
  assert.equal(result.status, "answered");
  if (result.status !== "answered") return;
  assert.equal(result.answer, "Di bawah 75, Bu. Itu wajib remedial.");
  assert.equal(result.detail, "KKM 75 berlaku untuk semua mapel.");
  const sent = llm.calls[0]!.content[0]!;
  assert.equal(sent.type === "text" && JSON.parse(sent.text).sapaan, "Bu");
});

test("a made-up quote turns the answer into 'Belum ada di panduan sekolah.'", async () => {
  const llm = fakeJsonCall({
    grounded_answer: {
      status: "answered",
      answer: "Cuti melahirkan tiga bulan.",
      citations: [{ chunk_id: "sop-p2-3-2", quote: "Cuti melahirkan diberikan selama tiga bulan" }],
    },
  });
  const result = await answerGrounded(
    { llm },
    { question: "Cuti melahirkan berapa lama?", chunks: SOP_CHUNKS },
  );
  assert.deepEqual(result, { status: "not_in_guide", answer: "Belum ada di panduan sekolah." });
});

test("with no active knowledge the model is never called", async () => {
  const llm = fakeJsonCall({});
  const inactive = SOP_CHUNKS.map((chunk) => ({ ...chunk, active: false }));
  const result = await answerGrounded({ llm }, { question: "KKM berapa?", chunks: inactive });
  assert.equal(result.status, "not_in_guide");
  assert.equal(llm.calls.length, 0);
});

test("a citation to an inactive chunk does not count", async () => {
  const chunks = SOP_CHUNKS.map((chunk) =>
    chunk.id === "sop-p2-3-2" ? { ...chunk, active: false } : chunk,
  );
  const llm = fakeJsonCall({
    grounded_answer: {
      status: "answered",
      answer: "KKM 75.",
      citations: [{ chunk_id: "sop-p2-3-2", quote: "untuk seluruh mata pelajaran adalah 75" }],
    },
  });
  const result = await answerGrounded({ llm }, { question: "KKM berapa?", chunks });
  assert.equal(result.status, "not_in_guide");
});

test("an answer that asks for a password is refused", async () => {
  const llm = fakeJsonCall({
    grounded_answer: {
      status: "answered",
      answer: "Kirim kata sandi Ibu ke operator.",
      citations: [{ chunk_id: "sop-p2-3-2", quote: "untuk seluruh mata pelajaran adalah 75" }],
    },
  });
  const result = await answerGrounded({ llm }, { question: "Bagaimana?", chunks: SOP_CHUNKS });
  assert.equal(result.status, "not_in_guide");
});

test("quotes are matched ignoring case, quotes and spacing, but not shortened to a word or two", () => {
  const chunk = SOP_CHUNKS[1]!;
  assert.ok(quoteIsInChunk("remedial dilaksanakan  paling banyak 2 KALI", chunk));
  assert.ok(!quoteIsInChunk("remedial", chunk));
});
