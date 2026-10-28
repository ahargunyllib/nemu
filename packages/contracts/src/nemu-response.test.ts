import assert from "node:assert/strict";
import { test } from "node:test";

import {
  momentOneResponse,
  momentThreeFollowUpResponse,
  momentThreeResponse,
  momentTwoResponse,
} from "./fixtures.js";
import { nemuResponseSchema } from "./index.js";

const lumpsumCalculation = momentTwoResponse.calc[0];

test("every Momen fixture response, including answers with calculations, is valid", () => {
  for (const response of [
    momentOneResponse,
    momentTwoResponse,
    momentThreeResponse,
    momentThreeFollowUpResponse,
  ]) {
    assert.ok(nemuResponseSchema.safeParse(response).success);
  }
});

test("a refuse, clarify, or error response with calculations is rejected", () => {
  for (const status of ["refuse", "clarify", "error"] as const) {
    const result = nemuResponseSchema.safeParse({
      ...momentTwoResponse,
      status,
      calc: [lumpsumCalculation],
      actions: [],
    });

    assert.equal(result.success, false, status);
    assert.deepEqual(
      result.error?.issues.map((issue) => issue.path),
      [["calc"]],
      status,
    );
  }
});

test("a refuse, clarify, or error response without calculations is accepted", () => {
  for (const status of ["refuse", "clarify", "error"] as const) {
    assert.ok(
      nemuResponseSchema.safeParse({ ...momentTwoResponse, status, calc: [], actions: [] }).success,
      status,
    );
  }
});
