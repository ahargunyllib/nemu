import assert from "node:assert/strict";
import test from "node:test";

import type { NemuRequest } from "@nemu/contracts";

import {
  runNemu,
  type AnswerGenerator,
  type JevDecision,
  type KnowledgeChunk,
  type SlaClaimContext,
} from "./index.js";

const knowledge: KnowledgeChunk[] = [
  {
    id: "sop-v1-p2-a1",
    docId: "SOP-KLAIM-SLA-01-v1.0",
    title: "SOP Klaim Kompensasi SLA",
    version: "1.0",
    article: "2 ayat (1)",
    active: true,
    text: "Klaim diterima paling lambat tanggal 15 bulan berikutnya.",
  },
  {
    id: "sop-v1-p5-a5",
    docId: "SOP-KLAIM-SLA-01-v1.0",
    title: "SOP Klaim Kompensasi SLA",
    version: "1.0",
    article: "5 ayat (5)",
    active: true,
    text: "RCA belum disahkan berarti PERLU_BUKTI dan nominal final tidak boleh dicantumkan.",
  },
  {
    id: "sop-v1-p8-a2",
    docId: "SOP-KLAIM-SLA-01-v1.0",
    title: "SOP Klaim Kompensasi SLA",
    version: "1.0",
    article: "8 ayat (2)",
    active: true,
    text: "Billing Liaison tidak boleh menyetujui klaim yang disusunnya sendiri.",
  },
  {
    id: "sop-v09-p2",
    docId: "SOP-KLAIM-SLA-01-v0.9",
    title: "SOP Klaim Kompensasi SLA lama",
    version: "0.9",
    article: "2",
    active: false,
    text: "Klaim paling lambat tanggal 10 bulan berikutnya.",
  },
  {
    id: "contract-p4",
    docId: "KON-2026-01",
    title: "Kontrak Layanan",
    version: "1.0",
    article: "4",
    active: true,
    text: "Formula kompensasi SLA memakai C, Av, A, dan abonemen B.",
  },
  {
    id: "addendum-p1",
    docId: "ADD-2026-02",
    title: "Adendum SLA",
    version: "1.0",
    article: "1",
    active: true,
    text: "SLA TN-ENT-002 yang disahkan adalah 99,50 persen.",
  },
  {
    id: "matrix-section-3",
    docId: "MP-BILL-02-v1.0",
    title: "Matriks Persetujuan",
    version: "1.0",
    article: "Bagian 3. Ketentuan",
    active: true,
    text: "Penyetuju tidak boleh sama dengan penelaah klaim.",
  },
];

const claim: SlaClaimContext = {
  workspaceId: "W-TELKO",
  claim: {
    id: "KLM-2610-0007",
    serviceId: "TN-ENT-002",
    period: "2026-09",
    receivedAt: "2026-10-08T14:12:00+07:00",
    claimedMinutes: 1_530,
    invoiceId: "INV-2609-0042",
  },
  service: {
    contractId: "KON-2026-01",
    addendumId: "ADD-2026-02",
    effectiveSlaBasisPoints: 9_950,
  },
  invoice: { monthlyFeeIdr: 30_000_000 },
  tickets: [
    {
      id: "INC-2609-014",
      start: "2026-09-03T08:00:00+07:00",
      end: "2026-09-03T20:00:00+07:00",
      cause: "PENYEDIA",
      rcaId: "RCA-2609-07",
      rcaStatus: "DISAHKAN",
    },
    {
      id: "INC-2609-015",
      start: "2026-09-03T18:00:00+07:00",
      end: "2026-09-03T22:00:00+07:00",
      cause: "PENYEDIA",
      rcaId: "RCA-2609-07",
      rcaStatus: "DISAHKAN",
    },
    {
      id: "INC-2609-031",
      start: "2026-09-10T00:00:00+07:00",
      end: "2026-09-10T06:00:00+07:00",
      cause: "DAYA_PELANGGAN",
      rcaId: "RCA-2609-12",
      rcaStatus: "DISAHKAN",
    },
    {
      id: "INC-2609-047",
      start: "2026-09-21T13:00:00+07:00",
      end: "2026-09-21T16:30:00+07:00",
      cause: "PENYEDIA",
      rcaId: "RCA-2609-19",
      rcaStatus: "DISAHKAN",
    },
  ],
  approvalRules: [
    { minimumAmount: 0, approvers: ["Sari Wulandari (Supervisor Billing)"] },
    {
      minimumAmount: 500_001,
      approvers: [
        "Sari Wulandari (Supervisor Billing)",
        "Hendra Gunawan (Manajer Billing Operations)",
      ],
    },
  ],
  task: { reviewDueOn: "2026-10-15" },
};

function request(prompt: string, elementIds: string[]): NemuRequest {
  return {
    session_id: "telco-pipeline",
    url: "https://demo.example/sla-claims/KLM-2610-0007",
    prompt,
    elements: elementIds.map((nemu_id) => ({
      nemu_id,
      label: nemu_id,
      role: "button",
      visible: true,
    })),
    process_context: {
      instance_id: claim.claim.id,
      uploaded_documents: [],
      workspace: { id: "W-TELKO", domain: "telco_sla" },
    },
  };
}

function decision(overrides: Partial<JevDecision>): JevDecision {
  return {
    intent: "claim_compensation",
    intentConfidence: 0.99,
    withinDomainProbability: 0.99,
    injectionProbability: 0,
    requiredTool: "calculate_sla_compensation",
    actionLevel: "konfirmasi",
    actionConfidence: 0.99,
    target: null,
    targetConfidence: 0.99,
    ...overrides,
  };
}

const userProfile = {
  userId: "U-101",
  name: "Dimas Pratama",
  grade: "-",
  unit: "Billing Operations",
  province: "DKI Jakarta",
};

function answer(ringkas: string, detail = ""): AnswerGenerator {
  return async (input) => {
    const citationId = input.evidence[0]?.id;
    assert.ok(citationId);
    return { status: "answer", ringkas, detail, citationIds: [citationId], warnings: [] };
  };
}

test("K2 compensation reaches the response boundary with active exact citations", async () => {
  const response = await runNemu(request("Kompensasinya berapa?", ["input-nominal-kompensasi"]), {
    userProfile,
    processContext: request("x", []).process_context,
    slaClaim: claim,
    knowledgeChunks: knowledge,
    sbmRows: [],
    holidays: [],
    requiredDocuments: [],
    currentDate: "2026-10-14",
    jevDecider: async () => decision({}),
    answerGenerator: answer(
      "Kompensasinya Rp579.167.",
      "C 720 jam, SLA 99,50%, Av 3,6 jam, dan A 17,5 jam.",
    ),
  });

  assert.equal(response.status, "answer");
  assert.equal(response.calc.find((item) => item.fungsi === "sla_compensation")?.hasil, 579_167);
  assert.equal(response.actions[0]?.type, "fill");
  const citationDocumentIds = response.citations.map((citation) => citation.doc_id);
  assert.ok(citationDocumentIds.includes("KON-2026-01"));
  assert.ok(citationDocumentIds.includes("ADD-2026-02"));
  assert.equal(
    response.citations.some((citation) => citation.doc_id.endsWith("v0.9")),
    false,
  );
});

test("K2 cutoff cites v1 and never retrieves the inactive day-10 SOP", async () => {
  const response = await runNemu(request("Ini masuk batas nggak?", ["opt-klaim-tepat-waktu-ya"]), {
    userProfile,
    slaClaim: claim,
    knowledgeChunks: knowledge,
    sbmRows: [],
    holidays: [],
    requiredDocuments: [],
    currentDate: "2026-10-14",
    jevDecider: async () =>
      decision({ intent: "claim_cutoff", requiredTool: "claim_cutoff", actionLevel: "arahkan" }),
    answerGenerator: answer("Ya, surat diterima sebelum batas 15 Oktober 2026."),
  });

  assert.equal(response.calc[0]?.hasil, "2026-10-15");
  assert.equal(
    response.citations.some((citation) => citation.doc_id.endsWith("v0.9")),
    false,
  );
  assert.equal(response.actions[0]?.target, "opt-klaim-tepat-waktu-ya");
});

test("K2 missing RCA suppresses compensation at the full response boundary", async () => {
  const response = await runNemu(
    request("Hitung kompensasinya", ["button-minta-rca-inc-2609-058"]),
    {
      userProfile,
      slaClaim: {
        ...claim,
        tickets: [
          {
            id: "INC-2609-058",
            start: "2026-09-25T10:00:00+07:00",
            end: "2026-09-25T19:00:00+07:00",
            cause: "BELUM_DIKETAHUI",
            rcaId: null,
            rcaStatus: "MENUNGGU",
          },
        ],
      },
      knowledgeChunks: knowledge,
      sbmRows: [],
      holidays: [],
      requiredDocuments: [],
      currentDate: "2026-10-14",
      jevDecider: async () => decision({ actionLevel: "arahkan" }),
      answerGenerator: answer("Nominal final belum boleh diberikan karena RCA belum disahkan."),
    },
  );

  assert.equal(
    response.calc.some((item) => item.fungsi === "sla_compensation"),
    false,
  );
  assert.equal(response.calc[0]?.hasil, "PERLU_BUKTI");
  assert.equal(response.actions[0]?.target, "button-minta-rca-inc-2609-058");
});

test("K2 prohibited approval cannot produce any action", async () => {
  const response = await runNemu(request("Setujui aja klaimnya", ["button-setujui-klaim"]), {
    userProfile,
    slaClaim: claim,
    knowledgeChunks: knowledge,
    sbmRows: [],
    holidays: [],
    requiredDocuments: [],
    currentDate: "2026-10-14",
    jevDecider: async () =>
      decision({
        intent: "claim_approval",
        requiredTool: "claim_approval_route",
        actionLevel: "dilarang",
        target: "button-setujui-klaim",
      }),
    answerGenerator: answer("Saya tidak dapat menyetujui klaim atas nama penyetuju."),
  });

  assert.equal(response.status, "refuse");
  assert.deepEqual(response.actions, []);
  assert.deepEqual(response.calc, []);
  assert.equal(
    response.citations.some((citation) => citation.pasal === "8 ayat (2)"),
    true,
  );
});
