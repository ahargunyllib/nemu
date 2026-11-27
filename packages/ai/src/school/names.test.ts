import assert from "node:assert/strict";
import test from "node:test";

import { CLASS_4B } from "./fixtures/sdit-nusantara.js";
import { matchKind, matchNames, nameScore, phoneticToken } from "./names.js";

test("exact, reordered and abbreviated names are accepted without asking", () => {
  const matches = matchNames(
    [
      { line: 1, nameRaw: "AHMAD FADIL" },
      { line: 17, nameRaw: "M. Rizky Pratama" },
      { line: 27, nameRaw: "Nurhaliza Siti" },
    ],
    CLASS_4B,
  );
  assert.deepEqual(
    matches.map((match) => [match.rosterName, match.status, match.kind]),
    [
      ["Ahmad Fadil", "auto", "exact"],
      ["Muhammad Rizky Pratama", "auto", "abbreviated"],
      ["Siti Nurhaliza", "auto", "reordered"],
    ],
  );
});

test("a grade-book photo confirms shortened names too (data-uji F1-1)", () => {
  const roster = [
    { studentId: "a", name: "Laila Nur Azizah", number: 16 },
    { studentId: "b", name: "Nabila Putri Ramadhani", number: 18 },
    { studentId: "c", name: "Taufik Hidayatullah", number: 27 },
    { studentId: "d", name: "Naufal Akbar", number: 19 },
  ];
  const matches = matchNames(
    [
      { line: 16, nameRaw: "Laila N.A." },
      { line: 18, nameRaw: "Nabila" },
      { line: 27, nameRaw: "Taufik H." },
      { line: 19, nameRaw: "Naufal Akbar" },
    ],
    roster,
    { confirmAbbreviated: true },
  );
  assert.deepEqual(
    matches.map((match) => [match.studentId, match.status]),
    [
      ["a", "ask"],
      ["b", "ask"],
      ["c", "ask"],
      ["d", "auto"],
    ],
  );
});

test("a spelling difference is matched but always confirmed with the teacher", () => {
  const [match] = matchNames([{ line: 10, nameRaw: "Farah Anisa" }], CLASS_4B);
  assert.equal(match?.rosterName, "Farah Annisa");
  assert.equal(match?.status, "ask");
  assert.equal(match?.kind, "spelling");
  assert.equal(match?.candidates[0]?.name, "Farah Annisa");
  assert.equal(match?.candidates.length, 2);
});

test("old spelling folds together for scoring", () => {
  assert.equal(phoneticToken("djoko"), phoneticToken("joko"));
  assert.equal(phoneticToken("achmad"), "ahmad");
  assert.ok(nameScore("Achmad Fadil", "Ahmad Fadil") > 0.9);
  assert.equal(matchKind("Achmad Fadil", "Ahmad Fadil"), "spelling");
});

test("assignment is one-to-one: two rows never land on the same student", () => {
  const matches = matchNames(
    [
      { line: 5, nameRaw: "Budi Santoso" },
      { line: 6, nameRaw: "Budi Santosa" },
    ],
    [
      { studentId: "a", name: "Budi Santoso", number: 5 },
      { studentId: "b", name: "Budy Santosa", number: 6 },
    ],
  );
  assert.deepEqual(
    matches.map((match) => match.studentId),
    ["a", "b"],
  );
  assert.equal(matches[0]?.status, "auto");
  assert.equal(matches[1]?.status, "ask");
});

test("an initial alone is never auto-accepted when it fits two students", () => {
  const [match] = matchNames(
    [{ line: 1, nameRaw: "Siti N." }],
    [
      { studentId: "a", name: "Siti Nurhaliza", number: 1 },
      { studentId: "b", name: "Siti Nabila", number: 2 },
    ],
  );
  assert.equal(match?.status, "ask");
});

test("a name that fits nobody is unmatched", () => {
  const [match] = matchNames([{ line: 40, nameRaw: "Xavier Quentin" }], CLASS_4B);
  assert.equal(match?.status, "unmatched");
  assert.equal(match?.studentId, null);
});

test("when the second reader disagrees on the name, the teacher is asked", () => {
  const [match] = matchNames(
    [{ line: 1, nameRaw: "Ahmad Fadil", nameAlt: "Ahmad Fadli" }],
    CLASS_4B,
  );
  assert.equal(match?.status, "ask");
});
