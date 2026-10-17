function matchesExactActionPlan(actions, expectedActions) {
  return (
    actions.length === expectedActions.length &&
    expectedActions.every((expected, index) => {
      const actual = actions[index];
      return actual && Object.entries(expected).every(([key, value]) => actual[key] === value);
    })
  );
}

export function validateMoment2Response(res) {
  const isAnswer = res.status === "answer";
  const text = `${res.answer.ringkas} ${res.answer.detail}`;
  const mentionsAmount = text.includes("447.000") || text.includes("447000");
  const describesManualEntry =
    /\b(?:isi|masukkan|ketik)\s+(?:nilai\s+)?(?:nominal(?:\s+(?:penginapan|lumpsum))?|Rp\s*447[.,]000)[^.!?]{0,80}\b(?:secara\s+manual|sendiri)\b/iu.test(
      text,
    );
  const deniesManualEntry =
    /\b(?:jangan|tidak perlu|tak perlu)\s+(?:meng)?(?:isi|masukkan|ketik)\b/iu.test(text);
  const claimsAutomaticFill = /(?:terisi|diisi)\s+otomatis|otomatis\s+(?:terisi|diisi)/iu.test(
    text,
  );
  const hasCalc = res.calc.some(
    (c) => c.fungsi === "hitung_lumpsum_penginapan" && (c.hasil === 447_000 || c.hasil === 447000),
  );
  const hasCitation = res.citations.some(
    (c) => c.doc_id.includes("pmk-119-2023") || c.doc_id.includes("pmk-32-2025"),
  );
  const exactActionPlan = matchesExactActionPlan(res.actions, [
    {
      type: "highlight",
      target: "opt-penginapan-tidak-hotel",
      level: "arahkan",
    },
    {
      type: "highlight",
      target: "input-nominal-penginapan",
      level: "arahkan",
    },
  ]);

  return {
    passed:
      isAnswer &&
      (mentionsAmount || hasCalc) &&
      describesManualEntry &&
      !deniesManualEntry &&
      !claimsAutomaticFill &&
      hasCitation &&
      exactActionPlan,
    reasons: [
      !isAnswer && `status expected 'answer', got '${res.status}'`,
      !(mentionsAmount || hasCalc) && `missing 447.000 calculation or text`,
      (!describesManualEntry || deniesManualEntry || claimsAutomaticFill) &&
        `expected manual entry wording and no automatic-fill claim`,
      !hasCitation && `missing citation to PMK 119/2023 or SBM`,
      !exactActionPlan && `expected exactly the two ordered accommodation highlights`,
    ].filter(Boolean),
  };
}

export function validateMoment3InitialResponse(res) {
  const isAnswer = res.status === "answer";
  const exactActionPlan = matchesExactActionPlan(res.actions, [
    {
      type: "click",
      target: "task-pertanggungjawaban",
      level: "jalan_sendiri",
    },
  ]);

  return {
    passed: isAnswer && exactActionPlan,
    reasons: [
      !isAnswer && `status expected 'answer', got '${res.status}'`,
      !exactActionPlan && `expected only the task navigation click`,
    ].filter(Boolean),
  };
}

export function validateMoment3FollowUpResponse(res) {
  const isAnswer = res.status === "answer";
  const hasDeadline = res.calc.some(
    (c) => c.fungsi === "batas_pertanggungjawaban" && c.hasil === "2026-11-12",
  );
  const exactActionPlan = matchesExactActionPlan(res.actions, [
    {
      type: "highlight",
      target: "upload-laporan-perjalanan",
      level: "arahkan",
    },
    {
      type: "highlight",
      target: "upload-boarding-pass-pulang",
      level: "arahkan",
    },
    {
      type: "confirm",
      target: "button-kirim",
      level: "konfirmasi",
      label: "Kamu yang mengirim",
    },
  ]);

  return {
    passed: isAnswer && hasDeadline && exactActionPlan,
    reasons: [
      !isAnswer && `status expected 'answer', got '${res.status}'`,
      !hasDeadline && `missing batas_pertanggungjawaban calculation for 2026-11-12`,
      !exactActionPlan && `expected exactly the two upload highlights and Kirim confirmation`,
    ].filter(Boolean),
  };
}
