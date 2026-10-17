import assert from "node:assert/strict";
import test from "node:test";

import {
  momentOneRequest,
  momentThreeFollowUpRequest,
  momentTwoRequest,
} from "@nemu/contracts/fixtures";
import { nemuActionSchema } from "@nemu/contracts";

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

test("contract rejects clicks that are not jalan_sendiri", () => {
  const result = nemuActionSchema.safeParse({
    type: "click",
    target: "button-kirim",
    level: "konfirmasi",
    label: "Kirim",
  });
  assert.equal(result.success, false);
});

test("orchestrator returns grounded calculations and a highlight for Moment 2", async () => {
  const jevDecider: JevDecider = async () => ({
    intent: "accommodation_question",
    intentConfidence: 0.98,
    withinDomainProbability: 0.99,
    injectionProbability: 0.01,
    requiredTool: "lookup_sbm_and_accommodation",
    actionLevel: "arahkan",
    actionConfidence: 0.96,
    target: "opt-penginapan-tidak-hotel",
    targetConfidence: 0.97,
  });
  const answerGenerator: AnswerGenerator = async (input) => {
    assert.equal(input.calculations.at(-1)?.hasil, 447_000);
    return {
      status: "answer",
      ringkas: "Pilih Tidak menginap di hotel. Hak penginapanmu adalah Rp447.000.",
      detail: "Nilainya dihitung dari 30 persen tarif hotel untuk dua malam.",
      citationIds: ["pmk-119-2023-page-6"],
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
  assert.equal(response.citations[0]?.halaman, 6);
  assert.deepEqual(response.actions, [
    {
      type: "highlight",
      target: "opt-penginapan-tidak-hotel",
      level: "arahkan",
      label: "Periksa ini",
    },
    {
      type: "highlight",
      target: "input-nominal-penginapan",
      level: "arahkan",
      label: "Periksa ini",
    },
  ]);
});

test("low confidence prevents automatic clicks", async () => {
  const jevDecider: JevDecider = async () => ({
    intent: "start_travel_request",
    intentConfidence: 0.6,
    withinDomainProbability: 0.9,
    injectionProbability: 0,
    requiredTool: "none",
    actionLevel: "jalan_sendiri",
    actionConfidence: 0.7,
    target: "menu-ajukan-perjalanan-dinas",
    targetConfidence: 0.7,
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

  assert.equal(response.actions[0]?.type, "highlight");
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

test("task-page accountability guidance normalizes document names in its action plan", async () => {
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
      intent: "accountability_question",
      intentConfidence: 0.99,
      withinDomainProbability: 0.99,
      injectionProbability: 0,
      requiredTool: "accountability_deadline",
      actionLevel: "konfirmasi",
      actionConfidence: 0.99,
      target: "button-kirim",
      targetConfidence: 0.99,
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
  assert.deepEqual(response.actions, [
    {
      type: "highlight",
      target: "upload-laporan-perjalanan",
      level: "arahkan",
      label: "Unggah dokumen ini",
    },
    {
      type: "highlight",
      target: "upload-boarding-pass-pulang",
      level: "arahkan",
      label: "Unggah dokumen ini",
    },
    {
      type: "confirm",
      target: "button-kirim",
      level: "konfirmasi",
      label: "Kamu yang mengirim",
    },
  ]);
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
      citationIds: ["pmk-119-2023-page-6"],
      warnings: [],
    }),
  });

  assert.equal(response.status, "error");
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
          citationIds: ["pmk-119-2023-page-6"],
          warnings: [],
        };
      },
    },
  );

  assert.equal(response.status, "answer");
  assert.equal(receivedEvidenceIds.includes("pmk-119-2023-page-6"), true);
  assert.equal(
    receivedEvidenceIds.some((id) => id.startsWith("pmk-54-2026")),
    false,
  );
});

test("the OpenRouter Responses adapter sends the crop and strict structured-output schema", async () => {
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
            citation_ids: ["pmk-119-2023-page-6"],
            warnings: [],
          }),
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    },
  });

  const evidence = retrieveKnowledge(DEMO_KNOWLEDGE_CHUNKS, "menginap di rumah saudara", 5);
  await generator({
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
  });

  assert.equal(requestUrl, "https://openrouter.ai/api/v1/responses");
  assert.equal(requestBody?.model, "openai/gpt-6.1-sol");
  assert.equal(requestBody?.max_output_tokens, 2_000);
  const input = requestBody?.input as Array<{ content: Array<{ type: string }> }>;
  assert.equal(
    input[0]?.content.some((item) => item.type === "input_image"),
    true,
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
