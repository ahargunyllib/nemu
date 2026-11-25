import assert from "node:assert/strict";
import test from "node:test";

import type { VerificationAnswer } from "@nemu/contracts/school";

import { F1_FINAL_VALUES, F1_READ_A, F1_READ_B, f1Page } from "../fixtures/f1-photo.js";
import { CLASS_4B } from "../fixtures/sdit-nusantara.js";
import { fakeJsonCall, textOf } from "../test-helpers.js";
import { combineReadings, outlierLines, readGradePhoto } from "./reading.js";
import { applySchoolRules } from "./rules.js";
import { applyAnswers, buildVerificationPlan } from "./verification.js";
import type { ModelReading } from "./vision.js";

const FINAL = F1_FINAL_VALUES;
const READ_A = F1_READ_A;
const READ_B = F1_READ_B;
const page = f1Page;

function photoReaders(rereadAnswers: Record<string, string>) {
  return {
    readA: fakeJsonCall({ grade_book_reading: READ_A }),
    readB: fakeJsonCall({ grade_book_reading: READ_B }),
    reread: fakeJsonCall({
      cell_reread: (request) => {
        const ids = [...textOf(request.content).matchAll(/id=(\d+)/gu)].map((match) => match[1]!);
        return { cells: ids.map((id) => ({ id, value: rereadAnswers[id] ?? "?" })) };
      },
    }),
  };
}

const IMAGE = { type: "image", dataUrl: "data:image/jpeg;base64,AAAA" } as const;

test("F1-1 shape: exactly the doubtful digits, differently spelled names and the S are asked", async () => {
  const readers = photoReaders({ "3": "86", "7": "61", "10": "71", "15": "78" });
  const result = await readGradePhoto(readers, {
    image: IMAGE,
    roster: CLASS_4B,
    assessment: "UTS",
  });
  assert.equal(result.status, "ok");
  if (result.status !== "ok") return;

  const plan = buildVerificationPlan(result.reading);
  const kinds = plan.questions.map((question) => `${question.kind}:${question.line}`);
  assert.deepEqual(kinds.sort(), [
    "absence:21",
    "digit:10",
    "digit:15",
    "digit:3",
    "digit:7",
    "name:11",
    "name:16",
    "name:2",
    "name:23",
    "name:30",
  ]);
  assert.equal(plan.acceptedCount, 22);
  assert.equal(plan.acceptedSentence, "22 nilai lain sudah cocok.");

  const farah = plan.questions.find((question) => question.line === 10);
  assert.equal(farah?.prompt, "Nilai Farah Annisa: 71 atau 77?");
  assert.deepEqual(farah?.kind === "digit" && farah.options, ["71", "77"]);
  assert.ok(farah?.box, "a digit question carries the crop box");

  // Only the four doubtful cells were re-read, in one call; the roster never reached a model.
  assert.equal(readers.reread.calls.length, 1);
  for (const call of [...readers.readA.calls, ...readers.readB.calls, ...readers.reread.calls]) {
    assert.doesNotMatch(textOf(call.content), /Ramadhani|Khairunnisa|Firmansyah/u);
  }
});

test("answers plus KKM 75 give 13 remedial and an empty value for the sick student", async () => {
  const readers = photoReaders({ "3": "86", "7": "61", "10": "71", "15": "78" });
  const result = await readGradePhoto(readers, {
    image: IMAGE,
    roster: CLASS_4B,
    assessment: "UTS",
  });
  assert.equal(result.status, "ok");
  if (result.status !== "ok") return;
  const plan = buildVerificationPlan(result.reading);

  const answers: VerificationAnswer[] = plan.questions.map((question) => {
    if (question.kind === "name")
      return { questionId: question.id, answer: question.options[0]!.studentId };
    if (question.kind === "absence") return { questionId: question.id, answer: "Kosongkan" };
    return { questionId: question.id, answer: String(FINAL[question.line - 1]) };
  });
  const applied = applyAnswers(result.reading, answers);
  assert.equal(applied.status, "ok");
  if (applied.status !== "ok") return;
  assert.equal(applied.entries.length, 32);

  const ruled = applySchoolRules(
    applied.column,
    applied.entries,
    { kkm: 75 },
    {
      "school.kkm": "sop-p2-3-2",
      "school.absence_blank": "sop-p3-4-3",
    },
  );
  assert.equal(ruled.status, "ok");
  if (ruled.status !== "ok") return;
  assert.deepEqual(ruled.summary, { filled: 31, blank: 1, remedial: 13 });
  const raka = ruled.entries.find((entry) => entry.name === "Raka Aditya");
  assert.deepEqual([raka?.value, raka?.status, raka?.remedial], [null, "S", false]);
  assert.equal(
    ruled.entries.find((entry) => entry.name === "Yusuf Ibrahim")?.remedial,
    false,
    "75 is not below KKM",
  );
  assert.equal(
    ruled.summarySentence,
    "31 nilai terisi, 1 dikosongkan, 13 remedial (di bawah KKM 75).",
  );
});

test("an unanswered question or a student picked twice keeps the result unresolved", async () => {
  const readers = photoReaders({ "3": "86", "7": "61", "10": "71", "15": "78" });
  const result = await readGradePhoto(readers, {
    image: IMAGE,
    roster: CLASS_4B,
    assessment: "UTS",
  });
  if (result.status !== "ok") throw new Error("expected ok");
  assert.deepEqual(applyAnswers(result.reading, []).status, "unresolved");

  const plan = buildVerificationPlan(result.reading);
  const answers = plan.questions.map((question) => ({
    questionId: question.id,
    answer: question.kind === "name" ? "4b-01" : "80",
  }));
  const applied = applyAnswers(result.reading, answers);
  assert.equal(applied.status, "unresolved");
});

test("rules without an active SOP source stop instead of applying an uncited KKM", () => {
  const result = applySchoolRules("c1", [], { kkm: 75 }, { "school.kkm": "sop-p2-3-2" });
  assert.equal(result.status, "needs_source");
  assert.deepEqual(result.status === "needs_source" && result.missing, ["school.absence_blank"]);
});

test("an unreadable page asks for a new photo and is never guessed", async () => {
  const unreadable: ModelReading = {
    page_quality: { readable: false, issues: ["blur"] },
    columns: [],
    rows: [],
  };
  const readers = {
    readA: fakeJsonCall({ grade_book_reading: unreadable }),
    readB: fakeJsonCall({ grade_book_reading: unreadable }),
    reread: fakeJsonCall({}),
  };
  const result = await readGradePhoto(readers, { image: IMAGE, roster: CLASS_4B });
  assert.equal(result.status, "reshoot");
  assert.equal(readers.reread.calls.length, 0);
});

test("a blank both readers agree on is accepted as blank; a 0 is always checked", () => {
  const a = page(true, { 1: { kind: "blank", value: null, raw: "" }, 2: { value: "0", raw: "0" } });
  const b = page(false, {
    1: { kind: "blank", value: null, raw: "" },
    2: { value: "0", raw: "0" },
  });
  const pending = combineReadings({ a, b, columnKey: "c1" });
  assert.equal(pending[0]?.reasons.size, 0);
  assert.ok(pending[1]?.reasons.has("zero_or_blank"));
});

test("a value far from the rest of the column is flagged even when both readers agree", () => {
  const values = Array.from({ length: 20 }, (_, index) => ({
    line: index + 1,
    value: 80 + (index % 5),
  }));
  values.push({ line: 21, value: 8 });
  assert.deepEqual([...outlierLines(values)], [21]);
});

test("without a cropper the re-read gets the whole page once, with cell positions", async () => {
  const readers = photoReaders({ "3": "86", "7": "61", "10": "71", "15": "78" });
  await readGradePhoto(readers, { image: IMAGE, roster: CLASS_4B, assessment: "UTS" });
  const content = readers.reread.calls[0]!.content;
  assert.equal(content.filter((part) => part.type === "image").length, 1);
  assert.match(textOf(content), /id=10: baris 10 \(Farah Annisa\), kolom UTS \(area x=/u);
});
