import assert from "node:assert/strict";
import test from "node:test";

import {
  momentThreeFollowUpResponse,
  momentThreeResponse,
  momentTwoResponse,
} from "@nemu/contracts/fixtures";

import {
  validateMoment2Response,
  validateMoment3FollowUpResponse,
  validateMoment3InitialResponse,
} from "./moment-validators.mjs";

test("Moment 2 validation requires exactly the two guidance highlights", () => {
  assert.equal(validateMoment2Response(momentTwoResponse).passed, true);
  assert.equal(
    validateMoment2Response({
      ...momentTwoResponse,
      actions: [
        ...momentTwoResponse.actions,
        {
          type: "confirm",
          target: "button-kirim",
          level: "konfirmasi",
          label: "Kamu yang mengirim",
        },
      ],
    }).passed,
    false,
  );
});

test("Moment 2 validation rejects false automatic-fill wording", () => {
  const result = validateMoment2Response({
    ...momentTwoResponse,
    answer: {
      ...momentTwoResponse.answer,
      ringkas: "Pilih Tidak menginap di hotel. Nominal penginapan terisi otomatis Rp447.000.",
    },
  });

  assert.equal(result.passed, false);
  assert.equal(
    result.reasons.some((reason) => reason.includes("manual entry")),
    true,
  );
});

test("Moment 2 validation rejects negated manual-entry wording", () => {
  const result = validateMoment2Response({
    ...momentTwoResponse,
    answer: {
      ringkas: "Jangan isi nominal penginapan Rp447.000 secara manual.",
      detail: "Perhitungannya tetap 30 persen dari tarif hotel untuk dua malam.",
    },
  });

  assert.equal(result.passed, false);
  assert.equal(
    result.reasons.some((reason) => reason.includes("manual entry")),
    true,
  );
});

test("Moment 3 initial validation requires only the task navigation click", () => {
  assert.equal(validateMoment3InitialResponse(momentThreeResponse).passed, true);
  assert.equal(
    validateMoment3InitialResponse({
      ...momentThreeResponse,
      actions: [
        ...momentThreeResponse.actions,
        {
          type: "highlight",
          target: "unrelated-control",
          level: "arahkan",
          label: "Periksa ini",
        },
      ],
    }).passed,
    false,
  );
});

test("Moment 3 follow-up validation accepts the required mixed-level plan", () => {
  assert.equal(validateMoment3FollowUpResponse(momentThreeFollowUpResponse).passed, true);
});
