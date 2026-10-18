import assert from "node:assert/strict";
import test from "node:test";

import {
  momentThreeFollowUpResponse,
  momentThreeResponse,
  momentTwoResponse,
} from "@nemu/contracts/fixtures";

import {
  hasUnnegatedAutomaticFillClaim,
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

test("Moment 2 validation accepts manual wording before the field name", () => {
  const result = validateMoment2Response({
    ...momentTwoResponse,
    answer: {
      ringkas: "Pilih Tidak menginap di hotel, lalu isi manual Nominal penginapan Rp447.000.",
      detail: "Perhitungannya 30 persen dari tarif hotel untuk dua malam.",
    },
  });

  assert.equal(result.passed, true);
});

test("Moment 2 validation accepts an explicit denial of automatic fill", () => {
  const result = validateMoment2Response({
    ...momentTwoResponse,
    answer: {
      ringkas: "Isi manual Nominal penginapan Rp447.000.",
      detail: "Nominal penginapan perlu dimasukkan sendiri, bukan terisi otomatis.",
    },
  });

  assert.equal(result.passed, true);
});

test("automatic-fill validation handles each claim independently", () => {
  assert.equal(
    hasUnnegatedAutomaticFillClaim(
      "Nominal tidak terisi otomatis saat offline, tetapi terisi otomatis saat online.",
    ),
    true,
  );
  assert.equal(hasUnnegatedAutomaticFillClaim("Nominal penginapan tidak otomatis terisi."), false);
  assert.equal(
    hasUnnegatedAutomaticFillClaim("Aplikasi mengisi otomatis nominal penginapan."),
    true,
  );
  assert.equal(hasUnnegatedAutomaticFillClaim("Aplikasi tidak mengisi secara otomatis."), false);
});

test("Moment 2 validation rejects a positive claim after a negated automatic-fill claim", () => {
  const result = validateMoment2Response({
    ...momentTwoResponse,
    answer: {
      ringkas: "Isi manual Nominal penginapan Rp447.000.",
      detail: "Nominal tidak terisi otomatis saat offline, tetapi terisi otomatis saat online.",
    },
  });

  assert.equal(result.passed, false);
});

test("Moment 2 validation rejects an active automatic-fill claim", () => {
  const result = validateMoment2Response({
    ...momentTwoResponse,
    answer: {
      ringkas: "Isi manual Nominal penginapan Rp447.000.",
      detail: "Namun aplikasi mengisi otomatis nominal penginapan.",
    },
  });

  assert.equal(result.passed, false);
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
