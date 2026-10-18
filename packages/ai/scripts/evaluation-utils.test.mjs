import assert from "node:assert/strict";
import test from "node:test";

const evaluationUtils = await import("./evaluation-utils.mjs").catch(() => ({}));

test("Momen 3 latency applies the eight-second target to each response", () => {
  assert.equal(typeof evaluationUtils.summarizeMomentLatency, "function");

  const summary = evaluationUtils.summarizeMomentLatency({
    moment1: [{ total_ms: 7_000 }],
    moment2: [{ total_ms: 5_500 }],
    moment3: [
      {
        initial_ms: 6_500,
        follow_up_ms: 7_100,
        end_to_end_ms: 13_600,
      },
    ],
  });

  assert.deepEqual(summary, {
    moment1: 7_000,
    moment2: 5_500,
    moment3_initial: 6_500,
    moment3_follow_up: 7_100,
    moment3_end_to_end: 13_600,
    within_8s_target: true,
  });
});

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
