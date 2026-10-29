import assert from "node:assert/strict";
import test from "node:test";

import {
  momentOneFollowUpRequest,
  momentOneFollowUpResponse,
  momentOneRequest,
  momentThreeFollowUpRequest,
  momentThreeRequest,
  momentTwoRequest,
} from "@nemu/contracts/fixtures";
import { nemuActionSchema } from "@nemu/contracts";
import { ALL_NEMU_IDS, NEMU_IDS } from "@nemu/contracts/nemu-ids";

import {
  DEMO_HOLIDAYS_2026,
  DEMO_KNOWLEDGE_CHUNKS,
  DEMO_REQUIRED_DOCUMENTS,
  DEMO_SBM_ROWS,
  DEMO_USER_PROFILE,
} from "./demo.js";
import {
  calculateAccommodationLumpSum,
  calculateAccountabilityDeadline,
  calculateRemainingWorkingDays,
  checkHotelRate,
  createJevDecider,
  createOpenRouterAnswerGenerator,
  findMissingDocuments,
  lookupSbm,
  retrieveKnowledge,
  runNemu,
  type AnswerGenerator,
  type JevDecider,
} from "./index.js";

function activeKnowledgeChunkId(location: {
  docId: string;
  page: number;
  article: string;
}): string {
  const chunk = DEMO_KNOWLEDGE_CHUNKS.find(
    (candidate) =>
      candidate.active &&
      candidate.docId === location.docId &&
      candidate.page === location.page &&
      candidate.article === location.article,
  );
  assert.ok(chunk, `Missing active knowledge chunk at ${JSON.stringify(location)}`);
  return chunk.id;
}

const accommodationCitationId = activeKnowledgeChunkId({
  docId: "pmk-119-2023",
  page: 6,
  article: "8 ayat (5)",
});

test("generated legal chunks preserve exact page and article boundaries", () => {
  const deadlineChunk = DEMO_KNOWLEDGE_CHUNKS.find(
    (chunk) =>
      chunk.id ===
      activeKnowledgeChunkId({
        docId: "pmk-113-2012",
        page: 9,
        article: "34 ayat (1)",
      }),
  );
  const accommodationChunk = DEMO_KNOWLEDGE_CHUNKS.find(
    (chunk) => chunk.id === accommodationCitationId,
  );

  assert.match(deadlineChunk?.text ?? "", /5 \(lima\) hari kerja/u);
  assert.match(accommodationChunk?.text ?? "", /30% \(tiga puluh persen\)/u);
  assert.ok(
    DEMO_KNOWLEDGE_CHUNKS.filter((chunk) => chunk.docId === "panduan-app").every(
      (chunk) => chunk.article === undefined,
    ),
  );
});

test("calculates the two-night non-hotel lump sum", () => {
  const result = calculateAccommodationLumpSum(745_000, 2);
  assert.equal(result.hasil, 447_000);
});

test("looks up the South Sulawesi Grade III hotel rate", () => {
  const result = lookupSbm(DEMO_SBM_ROWS, "sulawesi selatan", "hotel", "III/a");
  assert.equal(result?.value, 745_000);
});

test("calculates the five-working-day deadline after the return date", () => {
  const result = calculateAccountabilityDeadline("2026-11-05", []);
  assert.equal(result.hasil, "2026-11-12");
});

test("excludes weekends and holidays from deadline calculations", () => {
  const result = calculateAccountabilityDeadline("2026-11-05", ["2026-11-10"]);
  assert.equal(result.hasil, "2026-11-13");
});

test("calculates remaining working days through the deadline", () => {
  const result = calculateRemainingWorkingDays("2026-11-06", "2026-11-12", []);
  assert.equal(result.hasil, 4);
});

test("uses the demo holiday calendar for the year-end accountability deadline", () => {
  const result = calculateAccountabilityDeadline("2026-12-22", DEMO_HOLIDAYS_2026);
  assert.equal(result.hasil, "2026-12-31");
});

test("checks an entered hotel rate against the SBM ceiling", () => {
  assert.deepEqual(checkHotelRate(745_000, 900_000), {
    limit: 745_000,
    rate: 900_000,
    exceeds: true,
    difference: 155_000,
  });
});

test("finds missing documents using normalized names", () => {
  const missing = findMissingDocuments(
    ["Surat Tugas", "Boarding Pass Pulang", "Laporan Perjalanan"],
    ["surat tugas"],
  );
  assert.deepEqual(missing, ["Boarding Pass Pulang", "Laporan Perjalanan"]);
});

test("retrieval never returns inactive knowledge", () => {
  const results = retrieveKnowledge(
    DEMO_KNOWLEDGE_CHUNKS,
    "SBM tahun 2027 PMK 54 2026 tidak aktif",
    10,
  );
  assert.equal(
    results.some((result) => result.docId === "pmk-54-2026"),
    false,
  );
});

test("application guidance says the accommodation amount is entered manually", () => {
  const applicationGuidance = DEMO_KNOWLEDGE_CHUNKS.filter((chunk) => chunk.docId === "panduan-app")
    .map((chunk) => chunk.text)
    .join("\n");

  assert.match(applicationGuidance, /isi nominal penginapan/iu);
  assert.doesNotMatch(applicationGuidance, /nominal penginapan.+terisi otomatis/iu);
});

test("application guidance only references canonical Nemu element ids", () => {
  const applicationGuidance = DEMO_KNOWLEDGE_CHUNKS.filter((chunk) => chunk.docId === "panduan-app")
    .map((chunk) => chunk.text)
    .join("\n");
  const referencedIds = [...applicationGuidance.matchAll(/\[([^\]]+)\]/gu)].flatMap((match) =>
    match[1] ? [match[1]] : [],
  );
  const canonicalIds = new Set<string>(ALL_NEMU_IDS);

  assert.ok(referencedIds.length > 0);
  assert.deepEqual(
    referencedIds.filter((id) => !canonicalIds.has(id)),
    [],
  );
});

test("contract rejects clicks that are not jalan_sendiri", () => {
  const result = nemuActionSchema.safeParse({
    type: "click",
    target: "button-kirim",
    level: "konfirmasi",
    label: "Kirim",
  });
  assert.equal(result.success, false);
});

test("Moment 1 ignores an unrelated active process and opens a new request", async () => {
  const response = await runNemu(momentOneRequest, {
    userProfile: DEMO_USER_PROFILE,
    processContext: momentThreeRequest.process_context,
    knowledgeChunks: DEMO_KNOWLEDGE_CHUNKS,
    sbmRows: DEMO_SBM_ROWS,
    holidays: DEMO_HOLIDAYS_2026,
    requiredDocuments: DEMO_REQUIRED_DOCUMENTS,
    currentDate: "2026-11-06",
    jevDecider: async () => ({
      intent: "start_travel_request",
      intentConfidence: 0.98,
      withinDomainProbability: 0.99,
      injectionProbability: 0,
      requiredTool: "process_status",
      actionLevel: "arahkan",
      actionConfidence: 0.62,
      target: null,
      targetConfidence: 0.51,
    }),
    answerGenerator: async (input) => {
      const guidedInput = input as typeof input & { workflowGuidance?: readonly string[] };
      assert.equal(input.processContext, undefined);
      assert.equal(
        guidedInput.workflowGuidance?.some((guidance) => guidance.includes("new travel request")),
        true,
      );
      return {
        status: "answer",
        ringkas: "Saya bukakan formulir pengajuan perjalanan dinas baru.",
        detail: "Siapkan surat tugas dan dokumen pendukung sebelum mengirim.",
        citationIds: ["sop-pd-01-section-4"],
        warnings: [],
      };
    },
  });

  assert.deepEqual(response.actions, [
    {
      type: "click",
      target: "menu-ajukan-perjalanan-dinas",
      level: "jalan_sendiri",
      label: "Buka formulir",
    },
  ]);
  assert.equal(response.guide?.id, "travel-request:create");
  assert.equal(response.guide?.current_step, 1);
  assert.equal(response.guide?.steps.length, 6);
});

test("Moment 1 takes precedence when other workflow controls are also visible", async () => {
  const menuElement = momentOneRequest.elements[0];
  assert.ok(menuElement);
  const requests = [
    {
      ...momentTwoRequest,
      prompt: momentOneRequest.prompt,
      elements: [menuElement, ...momentTwoRequest.elements],
    },
    {
      ...momentThreeFollowUpRequest,
      prompt: momentOneRequest.prompt,
      elements: [menuElement, ...momentThreeFollowUpRequest.elements],
    },
  ];

  for (const request of requests) {
    const response = await runNemu(request, {
      userProfile: DEMO_USER_PROFILE,
      knowledgeChunks: DEMO_KNOWLEDGE_CHUNKS,
      sbmRows: DEMO_SBM_ROWS,
      holidays: DEMO_HOLIDAYS_2026,
      requiredDocuments: DEMO_REQUIRED_DOCUMENTS,
      currentDate: "2026-11-06",
      jevDecider: async () => ({
        intent: "start_travel_request",
        intentConfidence: 0.98,
        withinDomainProbability: 0.99,
        injectionProbability: 0,
        requiredTool: "process_status",
        actionLevel: "arahkan",
        actionConfidence: 0.62,
        target: null,
        targetConfidence: 0.51,
      }),
      answerGenerator: async (input) => {
        assert.equal(input.processContext, undefined);
        const citationId = input.evidence[0]?.id;
        assert.ok(citationId);
        return {
          status: "answer",
          ringkas: "Saya bukakan formulir pengajuan perjalanan dinas baru.",
          detail: "Siapkan surat tugas dan dokumen pendukung sebelum mengirim.",
          citationIds: [citationId],
          warnings: [],
        };
      },
    });

    assert.deepEqual(response.actions, [
      {
        type: "click",
        target: "menu-ajukan-perjalanan-dinas",
        level: "jalan_sendiri",
        label: "Buka formulir",
      },
    ]);
  }
});

test("Moment 2 uses trusted workflow context when Jev returns a non-ideal decision", async () => {
  const jevDecider: JevDecider = async () => ({
    intent: "unclear",
    intentConfidence: 0.51,
    withinDomainProbability: 0.99,
    injectionProbability: 0.01,
    requiredTool: "none",
    actionLevel: "konfirmasi",
    actionConfidence: 0.62,
    target: "input-nominal-penginapan",
    targetConfidence: 0.61,
  });
  const answerGenerator: AnswerGenerator = async (input) => {
    const guidedInput = input as typeof input & { workflowGuidance?: readonly string[] };
    assert.equal(input.calculations.at(-1)?.hasil, 447_000);
    assert.equal(
      guidedInput.workflowGuidance?.some((guidance) => guidance.includes("user-confirmed fill")),
      true,
    );
    return {
      status: "answer",
      ringkas: "Pilih Tidak menginap di hotel. Hak penginapanmu adalah Rp447.000.",
      detail: "Nilainya dihitung dari 30 persen tarif hotel untuk dua malam.",
      citationIds: [accommodationCitationId],
      warnings: ["Ubah isian bila nanti menginap di hotel"],
    };
  };

  const response = await runNemu(momentTwoRequest, {
    userProfile: DEMO_USER_PROFILE,
    processContext: momentTwoRequest.process_context,
    knowledgeChunks: DEMO_KNOWLEDGE_CHUNKS,
    sbmRows: DEMO_SBM_ROWS,
    holidays: DEMO_HOLIDAYS_2026,
    requiredDocuments: DEMO_REQUIRED_DOCUMENTS,
    currentDate: "2026-11-06",
    jevDecider,
    answerGenerator,
  });

  assert.equal(response.status, "answer");
  assert.equal(response.calc.at(-1)?.hasil, 447_000);
  assert.equal(
    response.citations.filter(
      (citation) =>
        citation.doc_id === "pmk-119-2023" &&
        citation.pasal === "8 ayat (5)" &&
        citation.halaman === 6,
    ).length,
    1,
  );
  assert.equal(
    response.citations.some(
      (citation) => citation.doc_id === "pmk-32-2025" && citation.halaman === 19,
    ),
    true,
  );
  assert.deepEqual(response.actions, [
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
  assert.equal(response.guide?.id, "travel-request:accommodation");
  assert.equal(response.guide?.current_step, 1);
  assert.deepEqual(
    response.guide?.steps.map(({ label }) => label),
    ["Pilih: tidak menginap", "Isi Rp447.000"],
  );
  assert.equal(
    response.actions.some((action) => "value" in action && action.value === "745000"),
    false,
  );
});

test("Moment 2 never fills a hidden or missing nominal target", async () => {
  const nominalTarget = momentTwoRequest.elements.find(
    (element) => element.nemu_id === "input-nominal-penginapan",
  );
  assert.ok(nominalTarget);

  const requests = [
    {
      ...momentTwoRequest,
      elements: momentTwoRequest.elements.map((element) =>
        element.nemu_id === nominalTarget.nemu_id ? { ...element, visible: false } : element,
      ),
    },
    {
      ...momentTwoRequest,
      elements: momentTwoRequest.elements.filter(
        (element) => element.nemu_id !== nominalTarget.nemu_id,
      ),
    },
  ];

  for (const request of requests) {
    const response = await runNemu(request, {
      userProfile: DEMO_USER_PROFILE,
      knowledgeChunks: DEMO_KNOWLEDGE_CHUNKS,
      sbmRows: DEMO_SBM_ROWS,
      holidays: DEMO_HOLIDAYS_2026,
      requiredDocuments: DEMO_REQUIRED_DOCUMENTS,
      currentDate: "2026-11-06",
      jevDecider: async () => ({
        intent: "accommodation_question",
        intentConfidence: 0.99,
        withinDomainProbability: 0.99,
        injectionProbability: 0,
        requiredTool: "lookup_sbm_and_accommodation",
        actionLevel: "konfirmasi",
        actionConfidence: 0.99,
        target: "input-nominal-penginapan",
        targetConfidence: 0.99,
      }),
      answerGenerator: async () => ({
        status: "answer",
        ringkas: "Gunakan hasil hitung Rp447.000.",
        detail: "Kamu tetap mengonfirmasi sebelum nilai dimasukkan.",
        citationIds: [accommodationCitationId],
        warnings: [],
      }),
    });

    assert.equal(
      response.actions.some((action) => action.type === "fill"),
      false,
    );
  }
});

test("Moment 2 replaces an automatic-fill claim with trusted manual-entry guidance", async () => {
  const response = await runNemu(momentTwoRequest, {
    userProfile: DEMO_USER_PROFILE,
    processContext: momentTwoRequest.process_context,
    knowledgeChunks: DEMO_KNOWLEDGE_CHUNKS,
    sbmRows: DEMO_SBM_ROWS,
    holidays: DEMO_HOLIDAYS_2026,
    requiredDocuments: DEMO_REQUIRED_DOCUMENTS,
    currentDate: "2026-11-06",
    jevDecider: async () => ({
      intent: "accommodation_question",
      intentConfidence: 0.99,
      withinDomainProbability: 0.99,
      injectionProbability: 0,
      requiredTool: "lookup_sbm_and_accommodation",
      actionLevel: "arahkan",
      actionConfidence: 0.99,
      target: "opt-penginapan-tidak-hotel",
      targetConfidence: 0.99,
    }),
    answerGenerator: async () => ({
      status: "answer",
      ringkas: "Pilih Tidak menginap di hotel. Nominal penginapan terisi otomatis Rp447.000.",
      detail: "Perhitungannya 30 persen dari tarif hotel untuk dua malam.",
      citationIds: [accommodationCitationId],
      warnings: [],
    }),
  });

  const answer = `${response.answer.ringkas} ${response.answer.detail}`;
  assert.match(answer, /(?:isi|masukkan).+(?:manual|sendiri)/iu);
  assert.doesNotMatch(answer, /(?:terisi|diisi)\s+(?:secara\s+)?otomatis/iu);
  assert.match(answer, /447[.]000/u);
});

test("recognized start intent opens the safe menu even at low confidence", async () => {
  const jevDecider: JevDecider = async () => ({
    intent: "start_travel_request",
    intentConfidence: 0.6,
    withinDomainProbability: 0.9,
    injectionProbability: 0,
    requiredTool: "none",
    actionLevel: "jalan_sendiri",
    actionConfidence: 0.99,
    target: "menu-ajukan-perjalanan-dinas",
    targetConfidence: 0.99,
  });
  const answerGenerator: AnswerGenerator = async () => ({
    status: "answer",
    ringkas: "Saya tunjukkan menu untuk memulai pengajuan perjalanan dinas.",
    detail: "Buka menu pengajuan dan siapkan dokumen yang diwajibkan.",
    citationIds: ["sop-pd-01-section-4"],
    warnings: [],
  });

  const response = await runNemu(
    {
      session_id: "s-low-confidence",
      url: "https://app.demo/",
      prompt: "Saya dapat surat tugas, mulai dari mana?",
      elements: [
        {
          nemu_id: "menu-ajukan-perjalanan-dinas",
          label: "Ajukan Perjalanan Dinas",
          role: "link",
          visible: true,
        },
      ],
    },
    {
      userProfile: DEMO_USER_PROFILE,
      knowledgeChunks: DEMO_KNOWLEDGE_CHUNKS,
      sbmRows: DEMO_SBM_ROWS,
      holidays: [],
      requiredDocuments: DEMO_REQUIRED_DOCUMENTS,
      currentDate: "2026-10-17",
      jevDecider,
      answerGenerator,
    },
  );

  assert.deepEqual(response.actions, [
    {
      type: "click",
      target: "menu-ajukan-perjalanan-dinas",
      level: "jalan_sendiri",
      label: "Buka formulir",
    },
  ]);
});

test("generic low-confidence actions remain highlights", async () => {
  const response = await runNemu(
    {
      session_id: "s-generic-low-confidence",
      url: "https://app.demo/",
      prompt: "Menu yang mana?",
      elements: [
        {
          nemu_id: "menu-ajukan-perjalanan-dinas",
          label: "Ajukan Perjalanan Dinas",
          role: "link",
          visible: true,
        },
      ],
    },
    {
      userProfile: DEMO_USER_PROFILE,
      knowledgeChunks: DEMO_KNOWLEDGE_CHUNKS,
      sbmRows: DEMO_SBM_ROWS,
      holidays: [],
      requiredDocuments: DEMO_REQUIRED_DOCUMENTS,
      currentDate: "2026-10-17",
      jevDecider: async () => ({
        intent: "unclear",
        intentConfidence: 0.6,
        withinDomainProbability: 0.9,
        injectionProbability: 0,
        requiredTool: "none",
        actionLevel: "jalan_sendiri",
        actionConfidence: 0.7,
        target: "menu-ajukan-perjalanan-dinas",
        targetConfidence: 0.7,
      }),
      answerGenerator: async () => ({
        status: "answer",
        ringkas: "Saya tunjukkan menu pengajuan perjalanan dinas.",
        detail: "Buka menu tersebut bila kamu ingin membuat pengajuan baru.",
        citationIds: ["sop-pd-01-section-4"],
        warnings: [],
      }),
    },
  );

  assert.equal(response.actions[0]?.type, "highlight");
});

test("start intent on the request form guides its six required fields in order", async () => {
  const targets = [
    NEMU_IDS.perdinForm.jenisPerjalanan,
    NEMU_IDS.perdinForm.kotaTujuan,
    NEMU_IDS.perdinForm.dasarPenugasan,
    NEMU_IDS.perdinForm.tanggalBerangkat,
    NEMU_IDS.perdinForm.tanggalKembali,
    NEMU_IDS.perdinForm.modaTransport,
  ] as const;
  const response = await runNemu(
    {
      session_id: "s-form-guidance",
      url: "https://app.demo/perdin/baru",
      prompt: "Cara ajukan dinas gimana?",
      elements: [
        {
          nemu_id: NEMU_IDS.shell.menuAjukanPerjalananDinas,
          label: "Ajukan Perjalanan Dinas",
          role: "link",
          visible: true,
        },
        ...targets.map((nemu_id, index) => ({
          nemu_id,
          label: nemu_id,
          role: "textbox",
          visible: index < 2,
        })),
      ],
      process_context: {
        instance_id: "PD-DRAFT",
        active_task: "isi_rencana",
        uploaded_documents: [],
      },
    },
    {
      userProfile: DEMO_USER_PROFILE,
      knowledgeChunks: DEMO_KNOWLEDGE_CHUNKS,
      sbmRows: DEMO_SBM_ROWS,
      holidays: [],
      requiredDocuments: DEMO_REQUIRED_DOCUMENTS,
      currentDate: "2026-10-17",
      jevDecider: async () => ({
        intent: "start_travel_request",
        intentConfidence: 0.6,
        withinDomainProbability: 0.99,
        injectionProbability: 0,
        requiredTool: "process_status",
        actionLevel: "arahkan",
        actionConfidence: 0.6,
        target: NEMU_IDS.shell.menuAjukanPerjalananDinas,
        targetConfidence: 0.6,
      }),
      answerGenerator: async (input) => {
        assert.equal(
          input.workflowGuidance?.some((guidance) => guidance.includes("six initial")),
          true,
        );
        const citationId = input.evidence[0]?.id;
        assert.ok(citationId);
        return {
          status: "answer",
          ringkas: "Isi enam bagian awal formulir secara berurutan.",
          detail: "Mulai dari jenis perjalanan sampai moda transportasi.",
          citationIds: [citationId],
          warnings: [],
        };
      },
    },
  );

  assert.deepEqual(
    response.actions,
    targets.map((target, index) => ({
      type: "highlight",
      target,
      level: "arahkan",
      label: [
        "Pilih jenis perjalanan",
        "Isi kota tujuan",
        "Pilih surat tugas",
        "Pilih tanggal berangkat",
        "Pilih tanggal kembali",
        "Pilih moda transportasi",
      ][index],
    })),
  );
  assert.equal(response.guide?.id, "travel-request:create");
  assert.equal(response.guide?.current_step, 1);
  assert.deepEqual(
    response.guide?.steps.map(({ target }) => target),
    targets,
  );
});

test("on the request form's first tab the guide points at the Jadwal tab for the dates", async () => {
  const response = await runNemu(momentOneFollowUpRequest, {
    userProfile: DEMO_USER_PROFILE,
    knowledgeChunks: DEMO_KNOWLEDGE_CHUNKS,
    sbmRows: DEMO_SBM_ROWS,
    holidays: [],
    requiredDocuments: DEMO_REQUIRED_DOCUMENTS,
    currentDate: "2026-10-17",
    jevDecider: async () => ({
      intent: "start_travel_request",
      intentConfidence: 0.99,
      withinDomainProbability: 0.99,
      injectionProbability: 0,
      requiredTool: "process_status",
      actionLevel: "arahkan",
      actionConfidence: 0.99,
      target: NEMU_IDS.perdinForm.jenisPerjalanan,
      targetConfidence: 0.99,
    }),
    answerGenerator: async (input) => ({
      status: "answer",
      ringkas: "Isi enam bagian awal formulir secara berurutan.",
      detail: "Mulai dari jenis perjalanan sampai moda transportasi.",
      citationIds: [input.evidence[0]?.id ?? ""],
      warnings: [],
    }),
  });

  assert.deepEqual(response.actions, momentOneFollowUpResponse.actions);
  assert.deepEqual(response.guide, momentOneFollowUpResponse.guide);
});

test("submit-like targets are always returned as confirmations", async () => {
  const jevDecider: JevDecider = async () => ({
    intent: "accountability_question",
    intentConfidence: 0.99,
    withinDomainProbability: 0.99,
    injectionProbability: 0,
    requiredTool: "process_status",
    actionLevel: "jalan_sendiri",
    actionConfidence: 0.99,
    target: "button-kirim",
    targetConfidence: 0.99,
  });
  const answerGenerator: AnswerGenerator = async () => ({
    status: "answer",
    ringkas: "Periksa dokumen sebelum kamu mengirim pertanggungjawaban.",
    detail: "Tombol Kirim hanya boleh ditekan oleh pengguna.",
    citationIds: ["sop-pd-01-section-4"],
    warnings: [],
  });

  const response = await runNemu(
    {
      session_id: "s-confirm",
      url: "https://app.demo/perdin/task",
      prompt: "Dokumennya sudah lengkap, sekarang apa?",
      elements: [{ nemu_id: "button-kirim", label: "Kirim", role: "button", visible: true }],
    },
    {
      userProfile: DEMO_USER_PROFILE,
      knowledgeChunks: DEMO_KNOWLEDGE_CHUNKS,
      sbmRows: DEMO_SBM_ROWS,
      holidays: [],
      requiredDocuments: DEMO_REQUIRED_DOCUMENTS,
      currentDate: "2026-11-06",
      jevDecider,
      answerGenerator,
    },
  );

  assert.deepEqual(response.actions, [
    {
      type: "confirm",
      target: "button-kirim",
      level: "konfirmasi",
      label: "Kamu yang mengirim",
    },
  ]);
});

test("Moment 3 follow-up uses trusted workflow context when Jev returns a non-ideal decision", async () => {
  const response = await runNemu(momentThreeFollowUpRequest, {
    userProfile: DEMO_USER_PROFILE,
    knowledgeChunks: DEMO_KNOWLEDGE_CHUNKS,
    sbmRows: DEMO_SBM_ROWS,
    holidays: DEMO_HOLIDAYS_2026,
    requiredDocuments: [
      "Surat Tugas",
      "Boarding Pass Pergi",
      "Boarding Pass Pulang",
      "Laporan Perjalanan",
    ],
    currentDate: "2026-11-06",
    jevDecider: async () => ({
      intent: "unclear",
      intentConfidence: 0.51,
      withinDomainProbability: 0.99,
      injectionProbability: 0,
      requiredTool: "process_status",
      actionLevel: "arahkan",
      actionConfidence: 0.65,
      target: "upload-boarding-pass-pulang",
      targetConfidence: 0.64,
    }),
    answerGenerator: async () => ({
      status: "answer",
      ringkas: "Lengkapi laporan perjalanan dan boarding pass pulang sebelum 12 November 2026.",
      detail: "Kamu yang menekan Kirim setelah semua dokumen lengkap.",
      citationIds: ["sop-pd-01-section-4"],
      warnings: [],
    }),
  });

  assert.equal(
    response.calc.some(
      (calculation) =>
        calculation.fungsi === "batas_pertanggungjawaban" && calculation.hasil === "2026-11-12",
    ),
    true,
  );
  assert.equal(
    response.calc.some(
      (calculation) => calculation.fungsi === "sisa_hari_kerja" && calculation.hasil === 4,
    ),
    true,
  );
  assert.equal(
    response.citations.some(
      (citation) =>
        citation.doc_id === "pmk-113-2012" &&
        citation.pasal === "34 ayat (1)" &&
        citation.halaman === 9,
    ),
    true,
  );
  assert.deepEqual(response.actions, [
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
  assert.equal(response.guide?.id, "travel-request:accountability");
  assert.equal(response.guide?.current_step, 1);
});

test("accountability guidance uses the final control label from the current page", async () => {
  let receivedGuidance: readonly string[] = [];
  const response = await runNemu(
    {
      ...momentThreeFollowUpRequest,
      elements: momentThreeFollowUpRequest.elements.map((element) =>
        element.nemu_id === "button-kirim" ? { ...element, label: "Selesaikan Tugas" } : element,
      ),
    },
    {
      userProfile: DEMO_USER_PROFILE,
      knowledgeChunks: DEMO_KNOWLEDGE_CHUNKS,
      sbmRows: DEMO_SBM_ROWS,
      holidays: DEMO_HOLIDAYS_2026,
      requiredDocuments: DEMO_REQUIRED_DOCUMENTS,
      currentDate: "2026-11-06",
      jevDecider: async () => ({
        intent: "accountability_question",
        intentConfidence: 0.99,
        withinDomainProbability: 0.99,
        injectionProbability: 0,
        requiredTool: "accountability_deadline",
        actionLevel: "arahkan",
        actionConfidence: 0.99,
        target: "upload-laporan-perjalanan",
        targetConfidence: 0.99,
      }),
      answerGenerator: async (input) => {
        receivedGuidance = input.workflowGuidance ?? [];
        return {
          status: "answer",
          ringkas: "Lengkapi dokumen, lalu gunakan Selesaikan Tugas.",
          detail: "Kamu yang menyelesaikan task setelah memeriksa dokumen.",
          citationIds: ["sop-pd-01-section-4"],
          warnings: [],
        };
      },
    },
  );

  assert.equal(response.status, "answer");
  assert.equal(
    receivedGuidance.some((guidance) => guidance.includes("Selesaikan Tugas")),
    true,
  );
});

test("workflow guidance includes missing accountability controls that are rendered off-screen", async () => {
  const response = await runNemu(
    {
      ...momentThreeFollowUpRequest,
      elements: momentThreeFollowUpRequest.elements.map((element) =>
        element.nemu_id === "upload-boarding-pass-pulang" || element.nemu_id === "button-kirim"
          ? { ...element, visible: false }
          : element,
      ),
      process_context: {
        ...momentThreeFollowUpRequest.process_context,
        uploaded_documents: [
          ...momentThreeFollowUpRequest.process_context.uploaded_documents,
          "laporan_perjalanan",
        ],
      },
    },
    {
      userProfile: DEMO_USER_PROFILE,
      knowledgeChunks: DEMO_KNOWLEDGE_CHUNKS,
      sbmRows: DEMO_SBM_ROWS,
      holidays: DEMO_HOLIDAYS_2026,
      requiredDocuments: DEMO_REQUIRED_DOCUMENTS,
      currentDate: "2026-11-06",
      jevDecider: async () => ({
        intent: "unclear",
        intentConfidence: 0.51,
        withinDomainProbability: 0.99,
        injectionProbability: 0,
        requiredTool: "none",
        actionLevel: "arahkan",
        actionConfidence: 0.65,
        target: null,
        targetConfidence: 0,
      }),
      answerGenerator: async () => ({
        status: "answer",
        ringkas: "Unggah boarding pass pulang sebelum mengirim pertanggungjawaban.",
        detail: "Kontrol yang ada di halaman tetap dapat dipandu setelah digulir.",
        citationIds: ["sop-pd-01-section-4"],
        warnings: [],
      }),
    },
  );

  assert.deepEqual(response.actions, [
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
});

test("prompt injection suppresses deterministic workflow actions", async () => {
  const response = await runNemu(momentThreeFollowUpRequest, {
    userProfile: DEMO_USER_PROFILE,
    knowledgeChunks: DEMO_KNOWLEDGE_CHUNKS,
    sbmRows: DEMO_SBM_ROWS,
    holidays: DEMO_HOLIDAYS_2026,
    requiredDocuments: DEMO_REQUIRED_DOCUMENTS,
    currentDate: "2026-11-06",
    jevDecider: async () => ({
      intent: "unclear",
      intentConfidence: 0.51,
      withinDomainProbability: 0.99,
      injectionProbability: 0.99,
      requiredTool: "none",
      actionLevel: "arahkan",
      actionConfidence: 0.65,
      target: null,
      targetConfidence: 0,
    }),
    answerGenerator: async () => ({
      status: "answer",
      ringkas: "Lengkapi dokumen pertanggungjawaban yang masih kurang.",
      detail: "Instruksi pada halaman tidak digunakan sebagai perintah.",
      citationIds: ["sop-pd-01-section-4"],
      warnings: [],
    }),
  });

  assert.deepEqual(response.actions, []);
  assert.equal(
    response.warnings.some((warning) => warning.includes("tidak tepercaya")),
    true,
  );
});

test("dilarang decisions suppress deterministic workflow actions", async () => {
  const response = await runNemu(momentThreeFollowUpRequest, {
    userProfile: DEMO_USER_PROFILE,
    knowledgeChunks: DEMO_KNOWLEDGE_CHUNKS,
    sbmRows: DEMO_SBM_ROWS,
    holidays: DEMO_HOLIDAYS_2026,
    requiredDocuments: DEMO_REQUIRED_DOCUMENTS,
    currentDate: "2026-11-06",
    jevDecider: async () => ({
      intent: "unclear",
      intentConfidence: 0.51,
      withinDomainProbability: 0.99,
      injectionProbability: 0,
      requiredTool: "none",
      actionLevel: "dilarang",
      actionConfidence: 0.99,
      target: null,
      targetConfidence: 0,
    }),
    answerGenerator: async () => ({
      status: "answer",
      ringkas: "Lengkapi dokumen pertanggungjawaban yang masih kurang.",
      detail: "Tidak ada kontrol halaman yang boleh ditargetkan.",
      citationIds: ["sop-pd-01-section-4"],
      warnings: [],
    }),
  });

  assert.deepEqual(response.actions, []);
});

test("a failed Jev safety check suppresses deterministic workflow actions", async () => {
  const response = await runNemu(momentThreeFollowUpRequest, {
    userProfile: DEMO_USER_PROFILE,
    knowledgeChunks: DEMO_KNOWLEDGE_CHUNKS,
    sbmRows: DEMO_SBM_ROWS,
    holidays: DEMO_HOLIDAYS_2026,
    requiredDocuments: DEMO_REQUIRED_DOCUMENTS,
    currentDate: "2026-11-06",
    jevDecider: async () => {
      throw new Error("Jev unavailable");
    },
    answerGenerator: async () => ({
      status: "answer",
      ringkas: "Lengkapi dokumen pertanggungjawaban yang masih kurang.",
      detail: "Tidak ada kontrol halaman yang boleh ditargetkan tanpa pemeriksaan keamanan.",
      citationIds: ["sop-pd-01-section-4"],
      warnings: [],
    }),
  });

  assert.deepEqual(response.actions, []);
  assert.equal(
    response.warnings.some((warning) => warning.includes("tidak tersedia")),
    true,
  );
});

test("Moment 3 highlights every visible missing accountability upload", async () => {
  const response = await runNemu(
    {
      ...momentThreeFollowUpRequest,
      elements: [
        {
          nemu_id: "upload-surat-tugas",
          label: "Unggah surat tugas",
          role: "button",
          visible: true,
        },
        {
          nemu_id: "upload-boarding-pass-pergi",
          label: "Unggah boarding pass pergi",
          role: "button",
          visible: true,
        },
        ...momentThreeFollowUpRequest.elements,
      ],
      process_context: {
        ...momentThreeFollowUpRequest.process_context,
        uploaded_documents: [],
      },
    },
    {
      userProfile: DEMO_USER_PROFILE,
      knowledgeChunks: DEMO_KNOWLEDGE_CHUNKS,
      sbmRows: DEMO_SBM_ROWS,
      holidays: DEMO_HOLIDAYS_2026,
      requiredDocuments: DEMO_REQUIRED_DOCUMENTS,
      currentDate: "2026-11-06",
      jevDecider: async () => ({
        intent: "unclear",
        intentConfidence: 0.51,
        withinDomainProbability: 0.99,
        injectionProbability: 0,
        requiredTool: "none",
        actionLevel: "arahkan",
        actionConfidence: 0.65,
        target: null,
        targetConfidence: 0,
      }),
      answerGenerator: async () => ({
        status: "answer",
        ringkas: "Lengkapi semua dokumen pertanggungjawaban yang masih kurang.",
        detail: "Kamu yang menekan Kirim setelah semua dokumen lengkap.",
        citationIds: ["sop-pd-01-section-4"],
        warnings: [],
      }),
    },
  );

  assert.deepEqual(
    response.actions.map((action) => action.target),
    [
      "upload-surat-tugas",
      "upload-boarding-pass-pergi",
      "upload-laporan-perjalanan",
      "upload-boarding-pass-pulang",
      "button-kirim",
    ],
  );
});

test("Moment 3 initial page keeps the task-navigation click", async () => {
  const response = await runNemu(momentThreeRequest, {
    userProfile: DEMO_USER_PROFILE,
    knowledgeChunks: DEMO_KNOWLEDGE_CHUNKS,
    sbmRows: DEMO_SBM_ROWS,
    holidays: DEMO_HOLIDAYS_2026,
    requiredDocuments: DEMO_REQUIRED_DOCUMENTS,
    currentDate: "2026-11-06",
    jevDecider: async () => ({
      intent: "accountability_question",
      intentConfidence: 0.99,
      withinDomainProbability: 0.99,
      injectionProbability: 0,
      requiredTool: "accountability_deadline",
      actionLevel: "jalan_sendiri",
      actionConfidence: 0.99,
      target: "task-pertanggungjawaban",
      targetConfidence: 0.99,
    }),
    answerGenerator: async () => ({
      status: "answer",
      ringkas: "Saya bukakan task Pertanggungjawaban.",
      detail: "Lengkapi dokumen sebelum batas waktu.",
      citationIds: ["sop-pd-01-section-4"],
      warnings: [],
    }),
  });

  assert.deepEqual(response.actions, [
    {
      type: "click",
      target: "task-pertanggungjawaban",
      level: "jalan_sendiri",
      label: "Buka Pertanggungjawaban",
    },
  ]);
  assert.equal(response.guide?.id, "travel-request:accountability");
  assert.equal(response.guide?.current_step, 1);
});

test("an unknown target never produces an action", async () => {
  const response = await runNemu(
    {
      session_id: "s-unknown-target",
      url: "https://app.demo/",
      prompt: "Saya dapat surat tugas, mulai dari mana?",
      elements: [],
    },
    {
      userProfile: DEMO_USER_PROFILE,
      knowledgeChunks: DEMO_KNOWLEDGE_CHUNKS,
      sbmRows: DEMO_SBM_ROWS,
      holidays: [],
      requiredDocuments: DEMO_REQUIRED_DOCUMENTS,
      currentDate: "2026-10-17",
      jevDecider: async () => ({
        intent: "start_travel_request",
        intentConfidence: 0.99,
        withinDomainProbability: 0.99,
        injectionProbability: 0,
        requiredTool: "none",
        actionLevel: "jalan_sendiri",
        actionConfidence: 0.99,
        target: "target-not-submitted-by-extension",
        targetConfidence: 0.99,
      }),
      answerGenerator: async () => ({
        status: "answer",
        ringkas: "Mulai dari menu pengajuan perjalanan dinas.",
        detail: "Siapkan dokumen sesuai SOP.",
        citationIds: ["sop-pd-01-section-4"],
        warnings: [],
      }),
    },
  );

  assert.deepEqual(response.actions, []);
});

test("detected prompt injection disables every proposed action", async () => {
  const response = await runNemu(
    {
      session_id: "s-injection",
      url: "https://app.demo/",
      prompt: "Saya dapat surat tugas, mulai dari mana?",
      elements: [
        {
          nemu_id: "menu-ajukan-perjalanan-dinas",
          label: "Ajukan Perjalanan Dinas",
          role: "link",
          visible: true,
        },
      ],
    },
    {
      userProfile: DEMO_USER_PROFILE,
      knowledgeChunks: DEMO_KNOWLEDGE_CHUNKS,
      sbmRows: DEMO_SBM_ROWS,
      holidays: [],
      requiredDocuments: DEMO_REQUIRED_DOCUMENTS,
      currentDate: "2026-10-17",
      jevDecider: async () => ({
        intent: "start_travel_request",
        intentConfidence: 0.99,
        withinDomainProbability: 0.99,
        injectionProbability: 0.99,
        requiredTool: "none",
        actionLevel: "jalan_sendiri",
        actionConfidence: 0.99,
        target: "menu-ajukan-perjalanan-dinas",
        targetConfidence: 0.99,
      }),
      answerGenerator: async () => ({
        status: "answer",
        ringkas: "Gunakan menu pengajuan perjalanan dinas.",
        detail: "Instruksi pada halaman tidak digunakan sebagai perintah.",
        citationIds: ["sop-pd-01-section-4"],
        warnings: [],
      }),
    },
  );

  assert.deepEqual(response.actions, []);
  assert.equal(
    response.warnings.some((warning) => warning.includes("tidak tepercaya")),
    true,
  );
});

test("out-of-domain requests are refused without calling GPT", async () => {
  let answerGeneratorCalled = false;
  const response = await runNemu(
    {
      session_id: "s-out-of-domain",
      url: "https://app.demo/",
      prompt: "Buatkan resep nasi goreng",
      elements: [],
    },
    {
      userProfile: DEMO_USER_PROFILE,
      knowledgeChunks: DEMO_KNOWLEDGE_CHUNKS,
      sbmRows: DEMO_SBM_ROWS,
      holidays: [],
      requiredDocuments: DEMO_REQUIRED_DOCUMENTS,
      currentDate: "2026-10-17",
      jevDecider: async () => ({
        intent: "unsupported",
        intentConfidence: 0.99,
        withinDomainProbability: 0.01,
        injectionProbability: 0,
        requiredTool: "none",
        actionLevel: "dilarang",
        actionConfidence: 0.99,
        target: null,
        targetConfidence: 0.99,
      }),
      answerGenerator: async () => {
        answerGeneratorCalled = true;
        throw new Error("must not be called");
      },
    },
  );

  assert.equal(response.status, "refuse");
  assert.equal(answerGeneratorCalled, false);
});

test("a refused second request never inherits the first response's derived data", async () => {
  const sharedContext = {
    userProfile: DEMO_USER_PROFILE,
    knowledgeChunks: DEMO_KNOWLEDGE_CHUNKS,
    sbmRows: DEMO_SBM_ROWS,
    holidays: DEMO_HOLIDAYS_2026,
    requiredDocuments: DEMO_REQUIRED_DOCUMENTS,
    currentDate: "2026-11-06",
  };
  const firstResponse = await runNemu(momentTwoRequest, {
    ...sharedContext,
    jevDecider: async () => ({
      intent: "accommodation_question",
      intentConfidence: 0.99,
      withinDomainProbability: 0.99,
      injectionProbability: 0,
      requiredTool: "lookup_sbm_and_accommodation",
      actionLevel: "konfirmasi",
      actionConfidence: 0.99,
      target: "input-nominal-penginapan",
      targetConfidence: 0.99,
    }),
    answerGenerator: async () => ({
      status: "answer",
      ringkas: "Gunakan hasil hitung Rp447.000.",
      detail: "Kamu tetap mengonfirmasi sebelum nilai dimasukkan.",
      citationIds: [accommodationCitationId],
      warnings: [],
    }),
  });
  assert.notEqual(firstResponse.calc.length, 0);

  const refusedResponse = await runNemu(
    {
      ...momentTwoRequest,
      prompt: "Uang harian ke Tokyo berapa?",
    },
    {
      ...sharedContext,
      jevDecider: async () => ({
        intent: "unsupported",
        intentConfidence: 0.99,
        withinDomainProbability: 0.01,
        injectionProbability: 0,
        requiredTool: "none",
        actionLevel: "dilarang",
        actionConfidence: 0.99,
        target: null,
        targetConfidence: 0.99,
      }),
      answerGenerator: async () => {
        throw new Error("refused requests must not call the answer generator");
      },
    },
  );

  assert.equal(refusedResponse.status, "refuse");
  assert.deepEqual(refusedResponse.calc, []);
  assert.deepEqual(refusedResponse.actions, []);
  assert.deepEqual(refusedResponse.citations, []);
  assert.equal(refusedResponse.guide, undefined);
});

test("missing SBM lookup input asks one clarification without calling GPT", async () => {
  let answerGeneratorCalled = false;
  const request = {
    ...momentTwoRequest,
    process_context: {
      instance_id: "PD-2026-0042",
      active_task: "isi_rencana",
      nights: 2,
      uploaded_documents: [],
    },
  };
  const response = await runNemu(request, {
    userProfile: DEMO_USER_PROFILE,
    knowledgeChunks: DEMO_KNOWLEDGE_CHUNKS,
    sbmRows: DEMO_SBM_ROWS,
    holidays: [],
    requiredDocuments: DEMO_REQUIRED_DOCUMENTS,
    currentDate: "2026-10-17",
    jevDecider: async () => ({
      intent: "accommodation_question",
      intentConfidence: 0.99,
      withinDomainProbability: 0.99,
      injectionProbability: 0,
      requiredTool: "lookup_sbm_and_accommodation",
      actionLevel: "arahkan",
      actionConfidence: 0.99,
      target: "opt-penginapan-tidak-hotel",
      targetConfidence: 0.99,
    }),
    answerGenerator: async () => {
      answerGeneratorCalled = true;
      throw new Error("must not be called");
    },
  });

  assert.equal(response.status, "clarify");
  assert.equal(response.answer.ringkas, "Provinsi tujuan perjalanan dinasnya apa?");
  assert.equal(answerGeneratorCalled, false);
});

test("missing or inactive deterministic tool provenance returns the safe error response", async () => {
  const inactiveCitationId = DEMO_KNOWLEDGE_CHUNKS.find((chunk) => !chunk.active)?.id;
  assert.ok(inactiveCitationId);

  for (const sourceCitationId of ["missing-tool-source", inactiveCitationId]) {
    const response = await runNemu(momentTwoRequest, {
      userProfile: DEMO_USER_PROFILE,
      processContext: momentTwoRequest.process_context,
      knowledgeChunks: DEMO_KNOWLEDGE_CHUNKS,
      sbmRows: DEMO_SBM_ROWS.map((row) =>
        row.component === "hotel" && row.province === "SULAWESI SELATAN" && row.grade === "III"
          ? { ...row, sourceCitationId }
          : row,
      ),
      holidays: [],
      requiredDocuments: DEMO_REQUIRED_DOCUMENTS,
      currentDate: "2026-10-17",
      jevDecider: async () => ({
        intent: "accommodation_question",
        intentConfidence: 0.99,
        withinDomainProbability: 0.99,
        injectionProbability: 0,
        requiredTool: "lookup_sbm_and_accommodation",
        actionLevel: "konfirmasi",
        actionConfidence: 0.99,
        target: "input-nominal-penginapan",
        targetConfidence: 0.99,
      }),
      answerGenerator: async () => ({
        status: "answer",
        ringkas: "Gunakan hasil hitung Rp447.000.",
        detail: "Kamu tetap mengonfirmasi sebelum nilai dimasukkan.",
        citationIds: [accommodationCitationId],
        warnings: [],
      }),
    });

    assert.equal(response.status, "error");
    assert.deepEqual(response.citations, []);
    assert.deepEqual(response.calc, []);
    assert.deepEqual(response.actions, []);
  }
});

test("untrusted rupiah amounts from GPT are rejected", async () => {
  const response = await runNemu(momentTwoRequest, {
    userProfile: DEMO_USER_PROFILE,
    processContext: momentTwoRequest.process_context,
    knowledgeChunks: DEMO_KNOWLEDGE_CHUNKS,
    sbmRows: DEMO_SBM_ROWS,
    holidays: [],
    requiredDocuments: DEMO_REQUIRED_DOCUMENTS,
    currentDate: "2026-10-17",
    jevDecider: async () => ({
      intent: "accommodation_question",
      intentConfidence: 0.99,
      withinDomainProbability: 0.99,
      injectionProbability: 0,
      requiredTool: "lookup_sbm_and_accommodation",
      actionLevel: "arahkan",
      actionConfidence: 0.99,
      target: "opt-penginapan-tidak-hotel",
      targetConfidence: 0.99,
    }),
    answerGenerator: async () => ({
      status: "answer",
      ringkas: "Nominalnya Rp999.000.",
      detail: "Nilai ini tidak berasal dari hasil hitung.",
      citationIds: [accommodationCitationId],
      warnings: [],
    }),
  });

  assert.equal(response.status, "error");
  assert.deepEqual(response.actions, []);
});

test("a refusal on the lodging page carries no SBM calculations", async () => {
  const response = await runNemu(
    { ...momentTwoRequest, prompt: "Uang harian ke Tokyo berapa?" },
    {
      userProfile: DEMO_USER_PROFILE,
      processContext: momentTwoRequest.process_context,
      knowledgeChunks: DEMO_KNOWLEDGE_CHUNKS,
      sbmRows: DEMO_SBM_ROWS,
      holidays: [],
      requiredDocuments: DEMO_REQUIRED_DOCUMENTS,
      currentDate: "2026-10-17",
      jevDecider: async () => ({
        intent: "accommodation_question",
        intentConfidence: 0.99,
        withinDomainProbability: 0.99,
        injectionProbability: 0,
        requiredTool: "lookup_sbm_and_accommodation",
        actionLevel: "arahkan",
        actionConfidence: 0.99,
        target: "opt-penginapan-tidak-hotel",
        targetConfidence: 0.99,
      }),
      answerGenerator: async () => ({
        status: "refuse",
        ringkas: "Tarif Tokyo tidak ada di sumber instansi.",
        detail: "Sumber yang tersedia hanya mencakup perjalanan dinas dalam negeri.",
        citationIds: [],
        warnings: [],
      }),
    },
  );

  assert.equal(response.status, "refuse");
  assert.deepEqual(response.calc, []);
  assert.deepEqual(response.actions, []);
});

test("a screenshot-only question receives active evidence for vision interpretation", async () => {
  let receivedEvidenceIds: string[] = [];
  const response = await runNemu(
    { ...momentTwoRequest, prompt: "Ini diisi apa?" },
    {
      userProfile: DEMO_USER_PROFILE,
      processContext: momentTwoRequest.process_context,
      knowledgeChunks: DEMO_KNOWLEDGE_CHUNKS,
      sbmRows: DEMO_SBM_ROWS,
      holidays: [],
      requiredDocuments: DEMO_REQUIRED_DOCUMENTS,
      currentDate: "2026-10-17",
      jevDecider: async () => ({
        intent: "accommodation_question",
        intentConfidence: 0.9,
        withinDomainProbability: 0.9,
        injectionProbability: 0,
        requiredTool: "lookup_sbm_and_accommodation",
        actionLevel: "arahkan",
        actionConfidence: 0.9,
        target: "opt-penginapan-tidak-hotel",
        targetConfidence: 0.9,
      }),
      answerGenerator: async (input) => {
        receivedEvidenceIds = input.evidence.map((chunk) => chunk.id);
        return {
          status: "answer",
          ringkas: "Pilih opsi tidak menginap di hotel dengan nilai Rp447.000.",
          detail: "Potongan layar menunjukkan bagian penginapan.",
          citationIds: [accommodationCitationId],
          warnings: [],
        };
      },
    },
  );

  assert.equal(response.status, "answer");
  assert.equal(receivedEvidenceIds.includes(accommodationCitationId), true);
  assert.equal(
    receivedEvidenceIds.some((id) => id.startsWith("pmk-54-2026")),
    false,
  );
});

test("the OpenRouter Responses adapter sends workflow guidance, crop, and strict output", async () => {
  let requestUrl: string | undefined;
  let requestBody: Record<string, unknown> | undefined;
  const generator = createOpenRouterAnswerGenerator({
    apiKey: "test-key",
    model: "openai/gpt-6.1-sol",
    reasoningEffort: "low",
    fetchImplementation: async (input, init) => {
      requestUrl = String(input);
      requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response(
        JSON.stringify({
          output_text: JSON.stringify({
            status: "answer",
            ringkas: "Pilih opsi tidak menginap di hotel.",
            detail: "Ikuti aturan pada sumber yang diberikan.",
            citation_ids: [accommodationCitationId],
            warnings: [],
          }),
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    },
  });

  const evidence = retrieveKnowledge(DEMO_KNOWLEDGE_CHUNKS, "menginap di rumah saudara", 5);
  const generationInput: Parameters<typeof generator>[0] & {
    workflowGuidance: readonly string[];
  } = {
    request: momentTwoRequest,
    userProfile: DEMO_USER_PROFILE,
    processContext: momentTwoRequest.process_context,
    evidence,
    calculations: [calculateAccommodationLumpSum(745_000, 2)],
    decision: {
      intent: "accommodation_question",
      intentConfidence: 0.99,
      withinDomainProbability: 0.99,
      injectionProbability: 0,
      requiredTool: "lookup_sbm_and_accommodation",
      actionLevel: "arahkan",
      actionConfidence: 0.99,
      target: "opt-penginapan-tidak-hotel",
      targetConfidence: 0.99,
    },
    missingDocuments: [],
    workflowGuidance: [
      "The accommodation amount is entered manually by the user. Never say it is filled automatically.",
    ],
  };
  await generator(generationInput);

  assert.equal(requestUrl, "https://openrouter.ai/api/v1/responses");
  assert.equal(requestBody?.model, "openai/gpt-6.1-sol");
  assert.equal(requestBody?.max_output_tokens, 2_000);
  const input = requestBody?.input as Array<{
    content: Array<{ type: string; text?: string }>;
  }>;
  assert.equal(
    input[0]?.content.some((item) => item.type === "input_image"),
    true,
  );
  const inputText = input[0]?.content.find((item) => item.type === "input_text")?.text;
  assert.deepEqual(
    JSON.parse(inputText ?? "{}").workflow_guidance,
    generationInput.workflowGuidance,
  );
  const text = requestBody?.text as { format?: { type?: string; strict?: boolean } };
  assert.deepEqual(
    { type: text.format?.type, strict: text.format?.strict },
    { type: "json_schema", strict: true },
  );
});

test("the OpenRouter Decisions adapter sends one Jev evaluation and parses confidence", async () => {
  let requestUrl: string | undefined;
  let requestBody: Record<string, unknown> | undefined;
  const decider = createJevDecider({
    apiKey: "test-key",
    model: "typesafe/jev-1.13",
    fetchImplementation: async (input, init) => {
      requestUrl = String(input);
      requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response(
        JSON.stringify({
          model: "typesafe/jev-1.13",
          answers: {
            intent: {
              type: "choice",
              choice: "start_travel_request",
              probabilities: { start_travel_request: 0.98, unclear: 0.02 },
              confidence: 0.96,
            },
            within_domain: { type: "noul", noul: 0.99 },
            contains_injection: { type: "noul", noul: 0.01 },
            required_tool: {
              type: "choice",
              choice: "none",
              probabilities: { none: 0.99 },
              confidence: 0.99,
            },
            action_level: {
              type: "choice",
              choice: "jalan_sendiri",
              probabilities: { jalan_sendiri: 0.98 },
              confidence: 0.96,
            },
            target: {
              type: "choice",
              choice: "target_0",
              probabilities: { target_0: 0.99, no_target: 0.01 },
              confidence: 0.98,
            },
          },
          usage: { input_tokens: 100, output_tokens: 20 },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    },
  });

  const decision = await decider({
    prompt: momentOneRequest.prompt,
    url: momentOneRequest.url,
    elements: momentOneRequest.elements,
  });

  assert.equal(requestUrl, "https://openrouter.ai/api/alpha/decisions");
  assert.equal(requestBody?.model, "typesafe/jev-1.13");
  assert.equal(Object.keys(requestBody?.questions as object).length, 6);
  assert.equal(decision.target, "menu-ajukan-perjalanan-dinas");
  assert.equal(decision.targetConfidence, 0.98);
});
