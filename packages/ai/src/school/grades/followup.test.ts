import assert from "node:assert/strict";
import test from "node:test";

import type { GradeEntry } from "@nemu/contracts/school";

import { sentenceIssues } from "../safety.js";
import { guidedCheck, guidedPrompt } from "./guided.js";
import { diffReadback } from "./readback.js";

const ENTRIES: GradeEntry[] = [
  { studentId: "1", name: "Budi Santoso", value: 77, status: "value", remedial: false },
  { studentId: "2", name: "Raka Aditya", value: null, status: "S", remedial: false },
  { studentId: "3", name: "Budi Hartono", value: 64, status: "value", remedial: true },
];

test("read-back matches when Rekap Nilai shows the same values and blanks", () => {
  const result = diffReadback(ENTRIES, [
    { name: "BUDI SANTOSO", value: "77" },
    { name: "Raka Aditya", value: "-" },
    { name: "Budi Hartono", value: "64,00" },
  ]);
  assert.deepEqual([result.match, result.sentence], [true, "Tersimpan, sama dengan buku."]);
});

test("read-back names the first mismatched student and never says 'salah'", () => {
  const result = diffReadback(ENTRIES, [
    { name: "Budi Santoso", value: "71" },
    { name: "Raka Aditya", value: "" },
  ]);
  assert.equal(result.match, false);
  assert.deepEqual(
    result.mismatches.map((item) => [item.name, item.expected, item.saved]),
    [
      ["Budi Santoso", "77", "71"],
      ["Budi Hartono", "64", null],
    ],
  );
  assert.equal(result.sentence, "Nilai Budi Santoso dan 1 lainnya belum sama dengan buku.");
  assert.deepEqual(sentenceIssues(result.sentence), []);
});

test("guided mode says the value and the name, using the full name when first names clash", () => {
  assert.equal(guidedPrompt(ENTRIES[0]!, ENTRIES), "Ketik 77 untuk Budi Santoso.");
  assert.equal(guidedPrompt(ENTRIES[1]!, ENTRIES), "Untuk Raka dikosongkan saja.");
  assert.deepEqual(guidedCheck(ENTRIES[0]!, "71"), { ok: false, sentence: "Di buku 77, Bu." });
  assert.deepEqual(guidedCheck(ENTRIES[0]!, " 77 "), { ok: true, sentence: "Sudah pas." });
  assert.deepEqual(guidedCheck(ENTRIES[1]!, "0", "Pak"), {
    ok: false,
    sentence: "Di buku ini kosong, Pak.",
  });
});
