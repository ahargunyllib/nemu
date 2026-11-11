import assert from "node:assert/strict";
import test from "node:test";

import { evaluateRetrieval } from "./retrieval-evaluation.mjs";

const questions = [
  { id: "A", pertanyaan: "first" },
  { id: "B", pertanyaan: "second" },
  { id: "C", pertanyaan: "third" },
  { id: "D", pertanyaan: "fourth" },
];
const gold = { A: ["a"], B: ["b1", "b2"], C: ["c"], D: ["d"] };
const retrieved = {
  first: ["a", "x"],
  second: ["x", "x", "b2", "b1"],
  third: ["x", "x", "x", "x", "c"],
  fourth: ["x"],
};

test("retrieval scores rank the first gold chunk retrieved for each question", () => {
  const report = evaluateRetrieval(questions, gold, (question) =>
    retrieved[question].map((id) => ({ id })),
  );

  assert.deepEqual(
    report.results.map((result) => [result.id, result.rank]),
    [
      ["A", 1],
      ["B", 3],
      ["C", 5],
      ["D", null],
    ],
  );
  assert.equal(report.hit_at_1, 0.25);
  assert.equal(report.hit_at_3, 0.5);
  assert.equal(report.hit_at_5, 0.75);
  assert.equal(report.mrr, 0.383);
});

test("a question without gold chunks fails the evaluation", () => {
  assert.throws(
    () => evaluateRetrieval([{ id: "Z", pertanyaan: "?" }], gold, () => []),
    /No gold chunks for Z/u,
  );
});
