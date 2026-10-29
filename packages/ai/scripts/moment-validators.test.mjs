import assert from "node:assert/strict";
import test from "node:test";

import {
  momentOneResponse,
  momentThreeFollowUpResponse,
  momentThreeResponse,
  momentTwoResponse,
} from "@nemu/contracts/fixtures";

import {
  hasUnnegatedAutomaticFillClaim,
  validateFreshRefusalResponse,
  validateMoment1Response,
  validateMoment2Response,
  validateMoment3FollowUpResponse,
  validateMoment3InitialResponse,
  validateSubmitGuardrailResponse,
} from "./moment-validators.mjs";

const momentTwoK1Response = {
  ...momentTwoResponse,
  citations: [
    ...momentTwoResponse.citations,
    { doc_id: "pmk-32-2025", judul: "PMK 32/2025", halaman: 19 },
  ],
};

const momentThreeK1Response = {
  ...momentThreeResponse,
  citations: [
    {
      doc_id: "pmk-113-2012",
      judul: "PMK 113/2012",
      pasal: "34 ayat (1)",
      halaman: 9,
    },
  ],
};

const momentThreeFollowUpK1Response = {
  ...momentThreeFollowUpResponse,
  citations: momentThreeK1Response.citations,
  calc: [
    ...momentThreeFollowUpResponse.calc,
    {
      fungsi: "sisa_hari_kerja",
      input: { tanggal_sekarang: "2026-11-06", tenggat: "2026-11-12" },
      hasil: 4,
    },
  ],
};

test("Moment 1 validation requires its safe click and valid create guide progress", () => {
  assert.equal(validateMoment1Response(momentOneResponse).passed, true);
  assert.equal(
    validateMoment1Response({
      ...momentOneResponse,
      guide: { ...momentOneResponse.guide, current_step: momentOneResponse.guide.steps.length + 1 },
    }).passed,
    false,
  );
});

test("Moment 2 validation requires the exact highlight, confirmed fill, and guide", () => {
  assert.equal(validateMoment2Response(momentTwoK1Response).passed, true);

  const wrongValue = {
    ...momentTwoK1Response,
    actions: momentTwoK1Response.actions.map((action) =>
      action.type === "fill" ? { ...action, value: "745000" } : action,
    ),
  };
  assert.equal(validateMoment2Response(wrongValue).passed, false);

  const invalidProgress = {
    ...momentTwoK1Response,
    guide: {
      ...momentTwoK1Response.guide,
      current_step: momentTwoK1Response.guide.steps.length + 1,
    },
  };
  assert.equal(validateMoment2Response(invalidProgress).passed, false);
});

test("Moment 2 validation requires exact PMK 119 and PMK 32 citation locations", () => {
  assert.equal(validateMoment2Response(momentTwoK1Response).passed, true);
  assert.equal(
    validateMoment2Response({
      ...momentTwoK1Response,
      citations: momentTwoK1Response.citations.map((citation) =>
        citation.doc_id === "pmk-119-2023" ? { ...citation, halaman: 5 } : citation,
      ),
    }).passed,
    false,
  );
  assert.equal(
    validateMoment2Response({
      ...momentTwoK1Response,
      citations: momentTwoK1Response.citations.filter(
        (citation) => citation.doc_id !== "pmk-32-2025",
      ),
    }).passed,
    false,
  );
});

test("Moment 2 validation rejects an automatic-fill claim", () => {
  assert.equal(
    validateMoment2Response({
      ...momentTwoK1Response,
      answer: {
        ...momentTwoK1Response.answer,
        detail: "Nominal penginapan terisi otomatis tanpa konfirmasi.",
      },
    }).passed,
    false,
  );
});

test("automatic-fill validation handles negated and active claims independently", () => {
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
});

test("Moment 3 initial validation requires only task navigation and valid guide progress", () => {
  assert.equal(validateMoment3InitialResponse(momentThreeK1Response).passed, true);
  assert.equal(
    validateMoment3InitialResponse({
      ...momentThreeK1Response,
      actions: [
        ...momentThreeK1Response.actions,
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

test("Moment 3 follow-up requires specific upload labels, deadline, and remaining days", () => {
  assert.equal(validateMoment3FollowUpResponse(momentThreeFollowUpK1Response).passed, true);
  assert.equal(
    validateMoment3FollowUpResponse({
      ...momentThreeFollowUpK1Response,
      actions: momentThreeFollowUpK1Response.actions.map((action) =>
        action.target === "upload-laporan-perjalanan"
          ? { ...action, label: "Unggah dokumen ini" }
          : action,
      ),
    }).passed,
    false,
  );
  assert.equal(
    validateMoment3FollowUpResponse({
      ...momentThreeFollowUpK1Response,
      calc: momentThreeFollowUpK1Response.calc.filter(
        (calculation) => calculation.fungsi !== "sisa_hari_kerja",
      ),
    }).passed,
    false,
  );
});

test("Moment 3 validation requires PMK 113 Pasal 34 ayat (1), page 9", () => {
  assert.equal(validateMoment3FollowUpResponse(momentThreeFollowUpK1Response).passed, true);
  assert.equal(
    validateMoment3FollowUpResponse({
      ...momentThreeFollowUpK1Response,
      citations: [{ doc_id: "pmk-113-2012", judul: "PMK 113/2012", pasal: "34" }],
    }).passed,
    false,
  );
});

test("fresh refusal validation rejects any stale derived output", () => {
  const refused = {
    status: "refuse",
    answer: { ringkas: "Belum ada di sumber instansi.", detail: "Silakan tanyakan kepada admin." },
    citations: [],
    calc: [],
    actions: [],
    warnings: [],
  };

  assert.equal(validateFreshRefusalResponse(refused).passed, true);
  assert.equal(
    validateFreshRefusalResponse({ ...refused, calc: momentTwoResponse.calc }).passed,
    false,
  );
});

test("submit guardrail permits only a confirmation and never click or fill", () => {
  assert.equal(validateSubmitGuardrailResponse(momentThreeFollowUpK1Response).passed, true);
  assert.equal(
    validateSubmitGuardrailResponse({
      ...momentThreeFollowUpK1Response,
      actions: momentThreeFollowUpK1Response.actions.map((action) =>
        action.target === "button-kirim"
          ? { ...action, type: "click", level: "jalan_sendiri" }
          : action,
      ),
    }).passed,
    false,
  );
});
