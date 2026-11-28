import assert from "node:assert/strict";
import test from "node:test";

import type { PageSnapshot } from "@nemu/contracts/school";

import { F2_2_PAGE, F2_3_PAGE, KAMUS_ROWS, NOT_IN_GUIDE_PAGES } from "./fixtures/kamus.js";
import { BU_SITI } from "./fixtures/sdit-nusantara.js";
import { explainError } from "./help.js";
import { guidedTargetOf, matchKamus, requestFromFix } from "./kamus.js";
import { mentionsSecret, sentenceIssues } from "./safety.js";
import { fakeJsonCall, textOf } from "./test-helpers.js";

const ask = (snapshot: PageSnapshot, llm = fakeJsonCall({})) =>
  explainError(
    { llm },
    { snapshot, question: "Nemu, ini kenapa?", kamus: KAMUS_ROWS, teacher: BU_SITI },
  );

function assertSafe(...texts: string[]) {
  for (const text of texts) {
    assert.doesNotMatch(text, /\bsalah\b/iu, text);
    assert.equal(mentionsSecret(text), false, text);
  }
}

test("F2-2: matched in code to Kamus Kendala no. 7, Pak Rizal fixes it, WhatsApp text ready", async () => {
  const llm = fakeJsonCall({});
  const result = await ask(F2_2_PAGE, llm);
  assert.equal(llm.calls.length, 0, "an exact kamus match needs no model call");
  assert.equal(result.status, "matched");
  if (result.status !== "matched") return;
  assert.equal(result.entryId, "K-07");
  assert.ok(result.sentence.startsWith("Bukan kesalahan Ibu."));
  assert.equal(result.sentence, "Bukan kesalahan Ibu. Yang bisa membantu: Pak Rizal.");
  assert.equal(result.detail, "Pak Rizal operator sekolah.");
  assert.deepEqual(sentenceIssues(result.sentence), []);
  assert.match(result.why, /^Bukan kesalahan Ibu\. Penugasan guru per mapel dan kelas diatur/u);
  assert.deepEqual([result.canSelfFix, result.guidedTarget], [false, null]);
  assert.deepEqual(result.citation, {
    chunkId: "kamus-k07",
    docId: "kamus-kendala",
    title: "Kamus Kendala",
    page: null,
    article: "K-07",
    quote: KAMUS_ROWS.find((row) => row.code === "K-07")!.fix,
  });
  assert.equal(result.fixer?.name, "Pak Rizal");
  assert.equal(result.waDraft?.phone, BU_SITI.contacts.operator!.phone);
  const text = result.waDraft?.text ?? "";
  assert.equal(
    text,
    'Assalamualaikum Pak Rizal, saya Siti (4B). Saat membuka Isi nilai kelas 4A muncul "Anda belum ditugaskan mengampu IPAS di kelas 4A". Mohon dibantu menambahkan penugasan guru untuk mapel dan kelas itu di pengaturan AlurSekolah. Terima kasih.',
  );
  assertSafe(result.sentence, result.why, text);
});

test("Info GTK 'Pengguna tidak ditemukan' (no. 3): a short message to Pak Rizal, said as signing in", async () => {
  const result = await ask({
    title: "Info GTK (tiruan)",
    url: "https://info-gtk.tiruan.local/masuk",
    alerts: ["Pengguna tidak ditemukan."],
    headings: ["Masuk Info GTK"],
    fields: [],
    screenshotBase64: null,
  });
  assert.equal(result.status, "matched");
  if (result.status !== "matched") return;
  assert.equal(result.sentence, "Bukan kesalahan Ibu. Yang bisa membantu: Pak Rizal.");
  assert.equal(
    result.waDraft?.text,
    'Assalamualaikum Pak Rizal, saya Siti (4B). Saat masuk Info GTK muncul "Pengguna tidak ditemukan". Mohon dibantu memeriksa email dan data PTK guru di Dapodik, memperbaikinya, lalu melakukan sinkronisasi. Terima kasih.',
  );
});

test("F2-3: matched in code to no. 2, she fixes it herself at Sinkro Ruang GTK, no WhatsApp", async () => {
  const llm = fakeJsonCall({});
  const result = await ask(F2_3_PAGE, llm);
  assert.equal(llm.calls.length, 0);
  assert.equal(result.status, "matched");
  if (result.status !== "matched") return;
  assert.equal(result.entryId, "K-02");
  assert.equal(result.sentence, "Ibu bisa memperbaikinya sendiri, saya tunjukkan caranya.");
  assert.deepEqual(
    [result.canSelfFix, result.guidedTarget, result.fixer, result.waDraft],
    [true, "Sinkro Ruang GTK", null, null],
  );
  assert.equal(result.why, "Akun E-Kinerja Ibu belum ditandai sebagai pengguna Ruang GTK.");
  // The extension points at the menu this sentence names before the button (cara 2).
  assert.match(result.citation.quote, /^Buka E-Kinerja, tekan tombol "Sinkro Ruang GTK"/u);
  assertSafe(result.sentence, result.why);
});

test("the RHK message (no. 1) is told apart from no. 2 although both start the same", async () => {
  const result = await ask({
    ...F2_3_PAGE,
    alerts: [
      "Data Perencanaan (SKP) Anda gagal dialirkan ke E-Kinerja. Alasan: Tidak ada RHK atasan yang bisa dikaitkan.",
    ],
  });
  assert.equal(result.status === "matched" && result.entryId, "K-01");
  assert.equal(result.status === "matched" && result.waDraft?.text.includes("Pak Ahmad"), true);
});

test("F2-6 (PK-409): no kamus row shares the message, so no model call and no invented cause", async () => {
  const llm = fakeJsonCall({});
  const result = await ask(NOT_IN_GUIDE_PAGES["F2-6 PK-409"]!, llm);
  assert.equal(llm.calls.length, 0);
  assert.equal(result.status, "not_in_guide");
  if (result.status !== "not_in_guide") return;
  assert.equal(
    result.sentence,
    "Belum ada di panduan sekolah. Mau saya bantu tanyakan ke Pak Rizal?",
  );
  assert.equal(result.waDraft?.phone, BU_SITI.contacts.operator!.phone);
  assert.match(result.waDraft?.text ?? "", /PK-409/u);
  assertSafe(result.sentence, result.waDraft?.text ?? "");
});

test("a near miss asks the model only to pick among the closest rows, and none means not in the guide", async () => {
  const llm = fakeJsonCall({ kamus_pick: { row_id: null } });
  const result = await ask(NOT_IN_GUIDE_PAGES["Ruang GTK, another reason"]!, llm);
  assert.equal(result.status, "not_in_guide");
  assert.equal(llm.calls.length, 1);
  const sent = JSON.parse(textOf(llm.calls[0]!.content));
  assert.deepEqual(sent.kandidat.map((row: { row_id: string }) => row.row_id).sort(), [
    "k01",
    "k02",
  ]);
  // No NIP, phone number or field value is sent to the model.
  assert.doesNotMatch(textOf(llm.calls[0]!.content), /197003152000032001|62812|isian/u);
});

test("a page with no error asks no model and is not in the guide", async () => {
  const llm = fakeJsonCall({});
  const result = await ask(NOT_IN_GUIDE_PAGES["Data Saya, no error"]!, llm);
  assert.equal(llm.calls.length, 0);
  assert.equal(result.status, "not_in_guide");
});

test("a picked row is answered from the row and the contacts, and an unknown id is refused", async () => {
  const page = {
    ...F2_2_PAGE,
    alerts: [
      "Tidak dapat menampilkan siswa. Anda belum ditugaskan mengampu Matematika di kelas 5A.",
    ],
    headings: ["Isi nilai kelas 5A"],
  };
  const picked = await ask(page, fakeJsonCall({ kamus_pick: { row_id: "k07" } }));
  assert.equal(picked.status === "matched" && picked.entryId, "K-07");
  assert.equal(picked.status === "matched" && picked.fixer?.name, "Pak Rizal");

  const invented = await ask(page, fakeJsonCall({ kamus_pick: { row_id: "k99" } }));
  assert.equal(invented.status, "not_in_guide");
});

test("a message with placeholders matches whatever fills them, in order", () => {
  const row = {
    ...KAMUS_ROWS.at(-1)!,
    message: "Anda belum ditugaskan mengampu [mapel] di kelas [kelas]",
  };
  const hit = matchKamus([row], ["Anda belum ditugaskan mengampu Bahasa Inggris di kelas 5B."]);
  assert.equal(hit.kind, "exact");
  assert.equal(
    matchKamus([row], ["di kelas 5B Anda belum ditugaskan mengampu"]).kind,
    "candidates",
  );
});

test("the button and the request come from the kamus text", () => {
  assert.equal(
    guidedTargetOf('Buka E-Kinerja, tekan tombol "Sinkro Ruang GTK", lalu ikuti.'),
    "Sinkro Ruang GTK",
  );
  assert.equal(guidedTargetOf("Guru cukup menekan tombol Masuk, lalu mengisi lagi."), "Masuk");
  assert.equal(
    guidedTargetOf("Buka menu tujuan pembelajaran untuk mapel tersebut, centang …"),
    "tujuan pembelajaran",
  );
  assert.equal(guidedTargetOf("Kepala sekolah menyelesaikan SKP."), null);
  assert.equal(
    requestFromFix("Operator sekolah perlu memperbarui data PTK di Dapodik. Lalu tunggu."),
    "memperbarui data PTK di Dapodik",
  );
  assert.equal(requestFromFix("Buka E-Kinerja, lalu tekan Sinkro."), null);
});
