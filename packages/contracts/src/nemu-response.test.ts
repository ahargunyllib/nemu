import assert from "node:assert/strict";
import test from "node:test";

import { nemuActionSchema, nemuResponseSchema, processContextSchema } from "./index.js";

const fill = {
  type: "fill",
  target: "input-nominal-penginapan",
  level: "konfirmasi",
  label: "Isi Rp447.000",
  value: "447000",
};

const guide = {
  id: "travel-request:accommodation",
  steps: [
    {
      id: "choose-non-hotel",
      target: "opt-penginapan-tidak-hotel",
      label: "Pilih: tidak menginap",
    },
    {
      id: "fill-accommodation-amount",
      target: "input-nominal-penginapan",
      label: "Isi Rp447.000",
    },
  ],
  current_step: 1,
};

function responseWithGuide(candidateGuide: unknown) {
  return {
    status: "answer",
    answer: { ringkas: "Ikuti langkah berikut." },
    citations: [],
    calc: [],
    actions: [],
    guide: candidateGuide,
    warnings: [],
  };
}

test("accepts a confirmed fill action with a raw input value", () => {
  const result = nemuActionSchema.safeParse(fill);

  assert.equal(result.success, true);
  assert.deepEqual(result.data, fill);
});

test("rejects fill actions without confirmation level or value", () => {
  const invalidFills = [
    { ...fill, level: "jalan_sendiri" },
    { ...fill, level: "arahkan" },
    { type: fill.type, target: fill.target, level: fill.level, label: fill.label },
    { ...fill, value: "" },
  ];

  for (const invalidFill of invalidFills) {
    assert.equal(nemuActionSchema.safeParse(invalidFill).success, false);
  }
});

test("accepts one-based guide progress within the step list", () => {
  const response = responseWithGuide(guide);
  const result = nemuResponseSchema.safeParse(response);

  assert.equal(result.success, true);
  assert.deepEqual(result.data, response);
});

test("rejects guide progress beyond the step list", () => {
  const result = nemuResponseSchema.safeParse(
    responseWithGuide({ ...guide, current_step: guide.steps.length + 1 }),
  );

  assert.equal(result.success, false);
});

test("rejects a guide on clarify, refuse, or error responses", () => {
  for (const status of ["clarify", "refuse", "error"] as const) {
    const result = nemuResponseSchema.safeParse({ ...responseWithGuide(guide), status });

    assert.equal(result.success, false, status);
    assert.deepEqual(
      result.error?.issues.map((issue) => issue.path),
      [["guide"]],
      status,
    );
  }
});

test("keeps legacy process context valid and accepts an optional workspace discriminator", () => {
  const legacy = { instance_id: "PD-2026-0001", uploaded_documents: [] };
  assert.equal(processContextSchema.safeParse(legacy).success, true);
  assert.equal(
    processContextSchema.safeParse({
      ...legacy,
      instance_id: "KLM-2610-0007",
      workspace: { id: "W-TELKO", domain: "telco_sla" },
    }).success,
    true,
  );
  assert.equal(
    processContextSchema.safeParse({
      ...legacy,
      workspace: { id: "W-TELKO", domain: "unknown" },
    }).success,
    false,
  );
});
