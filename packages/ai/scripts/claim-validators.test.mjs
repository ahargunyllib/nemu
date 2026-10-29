import assert from "node:assert/strict";
import test from "node:test";

import { buildK2EvaluationOutputs, K2_EXPECTED_RESULTS } from "./claim-evaluation.mjs";
import { validateK2Case, validateK2Response } from "./claim-validators.mjs";

const expected = K2_EXPECTED_RESULTS;

const corrupt = {
  "K2-01": (output) => {
    output.facts.reviewDueOn = "2026-10-16";
  },
  "K2-02": (output) => {
    output.facts.cutoff.deadline = "2026-10-10";
  },
  "K2-03": (output) => {
    output.facts.slaBasisPoints = 9_900;
  },
  "K2-04": (output) => {
    output.facts.actualDowntimeMinutes = 1_170;
  },
  "K2-05": (output) => {
    output.facts.compensation.amount = 429_167;
  },
  "K2-06": (output) => {
    output.facts.approvers = output.facts.approvers.slice(0, 1);
  },
  "K2-07": (output) => {
    output.calculations.push({ fungsi: "sla_compensation", hasil: 1 });
  },
  "K2-08": (output) => {
    output.facts.cutoff.deadline = "2026-09-10";
  },
  "K2-09": (output) => {
    output.facts.actualDowntimeMinutes = 1_530;
  },
  "K2-10": (output) => {
    output.actions.push({ type: "click", target: "button-setujui-klaim" });
  },
};

for (const [id, output] of Object.entries(buildK2EvaluationOutputs())) {
  test(`${id} accepts the exact deterministic expected result`, () => {
    const validation = validateK2Case(id, output, expected);
    assert.equal(validation.passed, true, validation.reasons.join("; "));
  });

  test(`${id} rejects its critical regression`, () => {
    const invalid = structuredClone(output);
    corrupt[id](invalid);
    assert.equal(validateK2Case(id, invalid, expected).passed, false);
  });

  test(`${id} validates the same facts at the Nemu response boundary`, () => {
    const response = {
      status: id === "K2-10" ? "refuse" : "answer",
      answer: { ringkas: output.guidance.join(" ") || "Hasil klaim SLA." },
      citations: output.sourceLocations.map((location) => ({
        doc_id: location.docId,
        judul: location.docId,
        pasal: location.article,
      })),
      calc: output.calculations,
      actions: output.actions,
      ...(output.guide ? { guide: output.guide } : {}),
      warnings: output.warnings,
    };
    const validation = validateK2Response(id, response, expected);
    assert.equal(validation.passed, true, validation.reasons.join("; "));
  });
}
