import assert from "node:assert/strict";
import test from "node:test";

import {
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
      guidedInput.workflowGuidance?.some((guidance) => guidance.includes("entered manually")),
      true,
    );
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
    NEMU_IDS.perdinForm.nomorSuratTugas,
    NEMU_IDS.perdinForm.kotaTujuan,
    NEMU_IDS.perdinForm.maksud,
    NEMU_IDS.perdinForm.tanggalBerangkat,
    NEMU_IDS.perdinForm.tanggalKembali,
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
          detail: "Mulai dari jenis perjalanan sampai tanggal kembali.",
          citationIds: [citationId],
          warnings: [],
        };
      },
    },
  );

  assert.deepEqual(
    response.actions,
    targets.map((target) => ({
      type: "highlight",
      target,
      level: "arahkan",
      label: "Periksa ini",
    })),
  );
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
      label: "Buka ini",
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
            citation_ids: ["pmk-119-2023-page-6"],
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
