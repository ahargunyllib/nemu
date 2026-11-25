import assert from "node:assert/strict";
import test from "node:test";

import { utils, write } from "xlsx";

import { CLASS_4B } from "../fixtures/sdit-nusantara.js";
import { fakeJsonCall } from "../test-helpers.js";
import { detectHeaders, maskGrid, parseGradeExcel } from "./excel.js";
import { buildVerificationPlan } from "./verification.js";

/** Shaped like data-uji F1-2: title rows, columns out of order, CAPS names, an average row. */
function messyWorkbook(): Uint8Array {
  const variants: Record<number, string> = {
    4: "BAGAS SAPUTRO",
    12: "HANA SALSABILLA",
    28: "SYIFA AULYA",
  };
  const rows: unknown[][] = [
    ["DAFTAR NILAI IPA KELAS 4B"],
    ["SDIT Nusantara - Semester Ganjil 2026/2027"],
    [],
    ["UTS", "No", "NAMA SISWA", "UH 1"],
  ];
  CLASS_4B.forEach((student, index) => {
    const line = index + 1;
    const uts = line === 9 ? "" : String(60 + ((line * 7) % 40));
    rows.push([uts, line, variants[line] ?? student.name.toUpperCase(), 70 + (line % 20)]);
  });
  rows.push(["78,4", "", "Rata-rata", ""]);
  const sheet = utils.aoa_to_sheet(rows);
  const workbook = utils.book_new();
  utils.book_append_sheet(workbook, sheet, "Nilai IPA");
  return new Uint8Array(write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer);
}

test("F1-2 shape: 31 values, the empty cell reported, 3 spellings asked, the average row skipped", async () => {
  const mapHeaders = fakeJsonCall({});
  const result = await parseGradeExcel(
    { mapHeaders },
    { bytes: messyWorkbook(), roster: CLASS_4B, assessment: "UTS" },
  );
  assert.equal(result.status, "ok");
  if (result.status !== "ok") return;
  const { reading } = result;

  assert.equal(mapHeaders.calls.length, 0, "a Nama header needs no model call");
  assert.equal(reading.rows.length, 32);
  assert.equal(reading.skippedRows, 1);
  assert.equal(reading.rows.filter((row) => row.cells[0]?.status === "value").length, 31);
  assert.equal(reading.rows[8]?.cells[0]?.status, "blank");
  assert.equal(reading.rows[0]?.nameRaw, "Ahmad Fadil", "CAPS names are title-cased");

  const plan = buildVerificationPlan(reading);
  assert.deepEqual(
    plan.questions.map((question) => `${question.kind}:${question.line}`),
    ["name:4", "name:12", "name:28"],
  );
  assert.equal(plan.acceptedSentence, "29 nilai lain sudah cocok. 1 nilai kosong di file.");
  assert.equal(reading.columns.map((column) => column.label).join(","), "UTS,UH 1");
});

test("the UH 1 column is used when the teacher asks for UH 1", async () => {
  const result = await parseGradeExcel(
    {},
    { bytes: messyWorkbook(), roster: CLASS_4B, assessment: "UH 1" },
  );
  assert.equal(result.status === "ok" && result.reading.rows[0]?.cells[0]?.raw, "71");
});

test("without a Nama header the model maps columns from masked rows, never the grades", async () => {
  const grid = [
    ["Siswa", "Skor"],
    ["AHMAD FADIL", "88"],
  ];
  assert.equal(detectHeaders(grid), null);
  assert.deepEqual(maskGrid(grid), [
    ["Siswa", "Skor"],
    ["Nama", "##"],
  ]);
});
