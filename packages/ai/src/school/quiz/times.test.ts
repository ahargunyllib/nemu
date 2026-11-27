import assert from "node:assert/strict";
import test from "node:test";

import { quizTimesFrom } from "./times.js";

const TODAY = "2026-11-27";

test("F4-2: dates without a clock time come back with time null (00.00 / 23.59 are the caller's)", () => {
  assert.deepEqual(
    quizTimesFrom("Masukkan kuis ini, buka Senin 30 November, tutup Kamis 3 Desember.", TODAY),
    { opens: { date: "2026-11-30", time: null }, closes: { date: "2026-12-03", time: null } },
  );
});

test("clock times she says stay with their own date", () => {
  assert.deepEqual(
    quizTimesFrom("dibuka 2 Desember jam 7 pagi, ditutup 4 Desember pukul 21.00", TODAY),
    { opens: { date: "2026-12-02", time: "07:00" }, closes: { date: "2026-12-04", time: "21:00" } },
  );
  assert.deepEqual(quizTimesFrom("buka 30/11 jam 9 malam sampai 3/12/2026 jam 10.30", TODAY), {
    opens: { date: "2026-11-30", time: "21:00" },
    closes: { date: "2026-12-03", time: "10:30" },
  });
});

test("only a close date: opens stays null so Nemu asks; no keywords: first opens, second closes", () => {
  assert.deepEqual(quizTimesFrom("tutup Kamis 3 Desember jam 23.59", TODAY), {
    opens: null,
    closes: { date: "2026-12-03", time: "23:59" },
  });
  assert.deepEqual(quizTimesFrom("30 November - 3 Desember", TODAY), {
    opens: { date: "2026-11-30", time: null },
    closes: { date: "2026-12-03", time: null },
  });
});

test("weekdays and relative days count from today; a past date without a year is next year's", () => {
  assert.deepEqual(quizTimesFrom("buka besok, tutup Senin", TODAY), {
    opens: { date: "2026-11-28", time: null },
    closes: { date: "2026-11-30", time: null },
  });
  assert.deepEqual(quizTimesFrom("buka 5 Januari", TODAY).opens, {
    date: "2027-01-05",
    time: null,
  });
  assert.deepEqual(quizTimesFrom("Nemu, masukkan kuis dari naskah ini.", TODAY), {
    opens: null,
    closes: null,
  });
});
