import assert from "node:assert/strict";
import test from "node:test";

const evaluationUtils = await import("./evaluation-utils.mjs").catch(() => ({}));

test("selective live evaluation accepts only Momen 2 and 3", () => {
  assert.equal(typeof evaluationUtils.parseEvaluationOptions, "function");
  assert.deepEqual(evaluationUtils.parseEvaluationOptions(["--live", "--moments=2,3"]), {
    isLive: true,
    selectedMoments: [2, 3],
  });
});

test("selective moment evaluation requires live mode", () => {
  assert.equal(typeof evaluationUtils.parseEvaluationOptions, "function");
  assert.throws(
    () => evaluationUtils.parseEvaluationOptions(["--offline", "--moments=2,3"]),
    /requires --live/iu,
  );
});
