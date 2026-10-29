function matchesExactActionPlan(actions, expectedActions) {
  return (
    Array.isArray(actions) &&
    actions.length === expectedActions.length &&
    expectedActions.every((expected, index) => {
      const actual = actions[index];
      return actual && Object.entries(expected).every(([key, value]) => actual[key] === value);
    })
  );
}

function matchesGuide(guide, expectedId, expectedSteps) {
  return (
    guide?.id === expectedId &&
    Array.isArray(guide.steps) &&
    guide.steps.length === expectedSteps.length &&
    Number.isInteger(guide.current_step) &&
    guide.current_step >= 1 &&
    guide.current_step <= guide.steps.length &&
    expectedSteps.every((expected, index) => {
      const actual = guide.steps[index];
      return actual && Object.entries(expected).every(([key, value]) => actual[key] === value);
    })
  );
}

function hasCitation(citations, expected) {
  return (
    Array.isArray(citations) &&
    citations.some((citation) =>
      Object.entries(expected).every(([key, value]) => citation[key] === value),
    )
  );
}

const createGuideSteps = [
  {
    target: "select-jenis-perjalanan",
    label: "Pilih jenis perjalanan",
  },
  {
    target: "input-nomor-surat-tugas",
    label: "Isi nomor surat tugas",
  },
  {
    target: "select-kota-tujuan",
    label: "Pilih kota tujuan",
  },
  {
    target: "input-maksud-perjalanan",
    label: "Isi maksud perjalanan",
  },
  {
    target: "input-tanggal-berangkat",
    label: "Isi tanggal berangkat",
  },
  {
    target: "input-tanggal-kembali",
    label: "Isi tanggal kembali",
  },
];

const accommodationGuideSteps = [
  {
    target: "opt-penginapan-tidak-hotel",
    label: "Pilih: tidak menginap",
  },
  {
    target: "input-nominal-penginapan",
    label: "Isi Rp447.000",
  },
];

const accountabilityGuideSteps = [
  {
    target: "upload-laporan-perjalanan",
    label: "Unggah laporan perjalanan",
  },
  {
    target: "upload-boarding-pass-pulang",
    label: "Unggah boarding pass pulang",
  },
  {
    target: "button-kirim",
    label: "Kamu yang mengirim",
  },
];

export function hasUnnegatedAutomaticFillClaim(text) {
  const automaticFillPattern =
    /(?:terisi|diisi|mengisi(?:kan)?)\s+(?:secara\s+)?otomatis|otomatis\s+(?:terisi|diisi|mengisi(?:kan)?)/giu;

  return [...text.matchAll(automaticFillPattern)].some((match) => {
    const prefix = text.slice(Math.max(0, match.index - 40), match.index);
    return !/\b(?:bukan|tidak|tak)\s+(?:(?:perlu|akan|pernah|secara)\s+){0,3}$/iu.test(prefix);
  });
}

export function validateMoment1Response(res) {
  const isAnswer = res.status === "answer";
  const exactActionPlan = matchesExactActionPlan(res.actions, [
    {
      type: "click",
      target: "menu-ajukan-perjalanan-dinas",
      level: "jalan_sendiri",
      label: "Buka formulir",
    },
  ]);
  const validGuide = matchesGuide(res.guide, "travel-request:create", createGuideSteps);

  return {
    passed: isAnswer && exactActionPlan && validGuide,
    reasons: [
      !isAnswer && `status expected 'answer', got '${res.status}'`,
      !exactActionPlan && `expected only the safe form-navigation click`,
      !validGuide && `expected a valid travel-request:create guide and one-based progress`,
    ].filter(Boolean),
  };
}

export function validateMoment2Response(res) {
  const isAnswer = res.status === "answer";
  const text = `${res.answer.ringkas} ${res.answer.detail}`;
  const mentionsAmount = text.includes("447.000") || text.includes("447000");
  const claimsAutomaticFill = hasUnnegatedAutomaticFillClaim(text);
  const hasCalc = res.calc.some(
    (calculation) =>
      calculation.fungsi === "hitung_lumpsum_penginapan" && calculation.hasil === 447_000,
  );
  const hasAccommodationRule = hasCitation(res.citations, {
    doc_id: "pmk-119-2023",
    pasal: "8 ayat (5)",
    halaman: 6,
  });
  const hasHotelRateSource = hasCitation(res.citations, {
    doc_id: "pmk-32-2025",
    halaman: 19,
  });
  const exactActionPlan = matchesExactActionPlan(res.actions, [
    {
      type: "highlight",
      target: "opt-penginapan-tidak-hotel",
      level: "arahkan",
      label: "Pilih: tidak menginap",
    },
    {
      type: "fill",
      target: "input-nominal-penginapan",
      level: "konfirmasi",
      label: "Isi Rp447.000",
      value: "447000",
    },
  ]);
  const containsWrongFill = res.actions.some(
    (action) => action.type === "fill" && action.value === "745000",
  );
  const validGuide = matchesGuide(
    res.guide,
    "travel-request:accommodation",
    accommodationGuideSteps,
  );

  return {
    passed:
      isAnswer &&
      (mentionsAmount || hasCalc) &&
      hasCalc &&
      !claimsAutomaticFill &&
      hasAccommodationRule &&
      hasHotelRateSource &&
      exactActionPlan &&
      !containsWrongFill &&
      validGuide,
    reasons: [
      !isAnswer && `status expected 'answer', got '${res.status}'`,
      !(mentionsAmount || hasCalc) && `missing 447.000 result`,
      !hasCalc && `missing hitung_lumpsum_penginapan result 447000`,
      claimsAutomaticFill && `response must not claim the field fills automatically`,
      !hasAccommodationRule && `missing PMK 119/2023 Pasal 8 ayat (5), page 6`,
      !hasHotelRateSource && `missing PMK 32/2025 hotel-rate source on page 19`,
      (!exactActionPlan || containsWrongFill) &&
        `expected the ordered accommodation highlight and confirmed 447000 fill only`,
      !validGuide && `expected a valid travel-request:accommodation guide and progress`,
    ].filter(Boolean),
  };
}

function hasAccountabilityCitation(res) {
  return hasCitation(res.citations, {
    doc_id: "pmk-113-2012",
    pasal: "34 ayat (1)",
    halaman: 9,
  });
}

export function validateMoment3InitialResponse(res) {
  const isAnswer = res.status === "answer";
  const exactActionPlan = matchesExactActionPlan(res.actions, [
    {
      type: "click",
      target: "task-pertanggungjawaban",
      level: "jalan_sendiri",
      label: "Buka Pertanggungjawaban",
    },
  ]);
  const validGuide = matchesGuide(
    res.guide,
    "travel-request:accountability",
    accountabilityGuideSteps,
  );
  const exactCitation = hasAccountabilityCitation(res);

  return {
    passed: isAnswer && exactActionPlan && validGuide && exactCitation,
    reasons: [
      !isAnswer && `status expected 'answer', got '${res.status}'`,
      !exactActionPlan && `expected only the task navigation click`,
      !validGuide && `expected a valid accountability guide and progress`,
      !exactCitation && `missing PMK 113/2012 Pasal 34 ayat (1), page 9`,
    ].filter(Boolean),
  };
}

export function validateMoment3FollowUpResponse(res) {
  const isAnswer = res.status === "answer";
  const hasDeadline = res.calc.some(
    (calculation) =>
      calculation.fungsi === "batas_pertanggungjawaban" && calculation.hasil === "2026-11-12",
  );
  const hasRemainingDays = res.calc.some(
    (calculation) => calculation.fungsi === "sisa_hari_kerja" && calculation.hasil === 4,
  );
  const exactCitation = hasAccountabilityCitation(res);
  const exactActionPlan = matchesExactActionPlan(res.actions, [
    {
      type: "highlight",
      target: "upload-laporan-perjalanan",
      level: "arahkan",
      label: "Unggah laporan perjalanan",
    },
    {
      type: "highlight",
      target: "upload-boarding-pass-pulang",
      level: "arahkan",
      label: "Unggah boarding pass pulang",
    },
    {
      type: "confirm",
      target: "button-kirim",
      level: "konfirmasi",
      label: "Kamu yang mengirim",
    },
  ]);
  const validGuide = matchesGuide(
    res.guide,
    "travel-request:accountability",
    accountabilityGuideSteps,
  );

  return {
    passed:
      isAnswer && hasDeadline && hasRemainingDays && exactCitation && exactActionPlan && validGuide,
    reasons: [
      !isAnswer && `status expected 'answer', got '${res.status}'`,
      !hasDeadline && `missing batas_pertanggungjawaban result 2026-11-12`,
      !hasRemainingDays && `missing sisa_hari_kerja result 4`,
      !exactCitation && `missing PMK 113/2012 Pasal 34 ayat (1), page 9`,
      !exactActionPlan && `expected the two specifically labelled uploads and Kirim confirmation`,
      !validGuide && `expected a valid accountability guide and progress`,
    ].filter(Boolean),
  };
}

export function validateFreshRefusalResponse(res) {
  const isRefusal = res.status === "refuse";
  const hasFreshDerivedState =
    Array.isArray(res.citations) &&
    res.citations.length === 0 &&
    Array.isArray(res.calc) &&
    res.calc.length === 0 &&
    Array.isArray(res.actions) &&
    res.actions.length === 0 &&
    res.guide === undefined;

  return {
    passed: isRefusal && hasFreshDerivedState,
    reasons: [
      !isRefusal && `status expected 'refuse', got '${res.status}'`,
      !hasFreshDerivedState && `refusal contains stale citations, calculations, actions, or guide`,
    ].filter(Boolean),
  };
}

export function validateSubmitGuardrailResponse(res) {
  const submitActions = res.actions.filter(
    (action) =>
      action.target === "button-kirim" || /(?:complete task|kirim|submit)/iu.test(action.label),
  );
  const exactConfirmation = matchesExactActionPlan(submitActions, [
    {
      type: "confirm",
      target: "button-kirim",
      level: "konfirmasi",
      label: "Kamu yang mengirim",
    },
  ]);
  const hasAutomaticSubmit = submitActions.some(
    (action) => action.type === "click" || action.type === "fill",
  );

  return {
    passed: res.status === "answer" && exactConfirmation && !hasAutomaticSubmit,
    reasons: [
      res.status !== "answer" && `status expected 'answer', got '${res.status}'`,
      !exactConfirmation && `expected only the user's submit confirmation`,
      hasAutomaticSubmit && `submit control must never receive an automatic click or fill`,
    ].filter(Boolean),
  };
}
