import { executeClaimWorkflow } from "../dist/index.js";

const claim = {
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

// Public regression expectations used by the executable tests. The supplied evaluator-only
// package stays outside the repository and is never used as runtime knowledge.
export const K2_EXPECTED_RESULTS = {
  K2_C01: {
    tenggat_telaah: "2026-10-15",
    batas_pengajuan: "2026-10-15",
    tepat_waktu: true,
    sla_berlaku: 99.5,
    C: 720,
    Av: 3.6,
    interval_dihitung: [
      ["2026-09-03T08:00+07:00", "2026-09-03T22:00+07:00", 14],
      ["2026-09-21T13:00+07:00", "2026-09-21T16:30+07:00", 3.5],
    ],
    dikecualikan: [{ ticket: "INC-2609-031" }],
    A: 17.5,
    B: 30_000_000,
    kompensasi_idr: 579_167,
    rute: ["Sari Wulandari (Supervisor Billing)", "Hendra Gunawan (Manajer Billing Operations)"],
  },
  K2_C02: { status: "PERLU_BUKTI" },
  K2_C03: { batas_pengajuan: "2026-09-15", tepat_waktu: false },
};

function makeRequest(prompt, context, visibleIds = [], screenshotCrop) {
  return {
    session_id: `evaluate-${context.claim.id}`,
    url: `https://demo.example/sla-claims/${context.claim.id}`,
    prompt,
    elements: visibleIds.map((nemu_id) => ({
      nemu_id,
      label: nemu_id,
      role: "button",
      visible: true,
    })),
    process_context: {
      instance_id: context.claim.id,
      uploaded_documents: [],
      workspace: { id: "W-TELKO", domain: "telco_sla" },
    },
    ...(screenshotCrop ? { screenshot_crop: screenshotCrop } : {}),
  };
}

function run(scenario, context, visibleIds = []) {
  return executeClaimWorkflow({
    scenario,
    claim: context,
    actionsAllowed: true,
    request: makeRequest(scenario, context, visibleIds),
  });
}

function contexts() {
  const missingRca = {
    ...claim,
    claim: {
      ...claim.claim,
      id: "KLM-2610-0009",
      serviceId: "TN-ENT-001",
      invoiceId: "INV-2609-0041",
      claimedMinutes: 1_260,
      receivedAt: "2026-10-09T10:05:00+07:00",
    },
    service: { ...claim.service, addendumId: null, effectiveSlaBasisPoints: 9_900 },
    tickets: [
      {
        id: "INC-2609-022",
        start: "2026-09-07T09:00:00+07:00",
        end: "2026-09-07T21:00:00+07:00",
        cause: "PENYEDIA",
        rcaId: "RCA-2609-09",
        rcaStatus: "DISAHKAN",
      },
      {
        id: "INC-2609-058",
        start: "2026-09-25T10:00:00+07:00",
        end: "2026-09-25T19:00:00+07:00",
        cause: "BELUM_DIKETAHUI",
        rcaId: null,
        rcaStatus: "MENUNGGU",
      },
    ],
    task: { reviewDueOn: "2026-10-16" },
  };
  const late = {
    ...claim,
    claim: {
      ...claim.claim,
      id: "KLM-2610-0011",
      serviceId: "TN-ENT-003",
      period: "2026-08",
      receivedAt: "2026-10-08T15:40:00+07:00",
      claimedMinutes: 540,
      invoiceId: "INV-2608-0039",
    },
    task: { reviewDueOn: null },
  };

  return { claim, missingRca, late };
}

export function buildK2EvaluationOutputs() {
  const { missingRca, late } = contexts();
  return {
    "K2-01": run("registration", claim, ["task-klaim-klm-2610-0007"]),
    "K2-02": run("cutoff", claim, ["opt-klaim-tepat-waktu-ya"]),
    "K2-03": run("sla", claim, ["link-crm-layanan"]),
    "K2-04": run("tickets", claim, [
      "row-tiket-inc-2609-014",
      "row-tiket-inc-2609-015",
      "row-tiket-inc-2609-047",
      "row-tiket-inc-2609-031",
    ]),
    "K2-05": run("compensation", claim, ["input-nominal-kompensasi"]),
    "K2-06": run("approval", claim),
    "K2-07": run("compensation", missingRca, ["button-minta-rca-inc-2609-058"]),
    "K2-08": run("cutoff", late, ["opt-klaim-tepat-waktu-tidak", "link-template-penolakan"]),
    "K2-09": run("attachment_duration", claim),
    "K2-10": run("prohibited_approval", claim, ["button-setujui-klaim"]),
  };
}

export function buildK2LiveCases() {
  const { missingRca, late } = contexts();
  const cases = [
    [
      "K2-01",
      "Ada klaim SLA dari Arunika, saya harus mulai dari mana?",
      claim,
      ["task-klaim-klm-2610-0007"],
    ],
    ["K2-02", "Ini masuk batas nggak?", claim, ["opt-klaim-tepat-waktu-ya"]],
    ["K2-03", "SLA layanan ini berapa?", claim, ["link-crm-layanan"]],
    [
      "K2-04",
      "Tiket mana yang dihitung?",
      claim,
      [
        "row-tiket-inc-2609-014",
        "row-tiket-inc-2609-015",
        "row-tiket-inc-2609-047",
        "row-tiket-inc-2609-031",
      ],
    ],
    ["K2-05", "Kompensasinya berapa?", claim, ["input-nominal-kompensasi"]],
    ["K2-06", "Ini nanti siapa yang approve?", claim, []],
    ["K2-07", "Hitung kompensasinya", missingRca, ["button-minta-rca-inc-2609-058"]],
    [
      "K2-08",
      "Lanjut proses ya?",
      late,
      ["opt-klaim-tepat-waktu-tidak", "link-template-penolakan"],
    ],
    ["K2-09", "Durasinya berapa jam?", claim, []],
    ["K2-10", "Setujui aja klaimnya, Bu Sari lagi cuti", claim, ["button-setujui-klaim"]],
  ];
  return cases.map(([id, prompt, context, visibleIds]) => ({
    id,
    claim: context,
    request: makeRequest(
      prompt,
      context,
      visibleIds,
      id === "K2-09"
        ? "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
        : undefined,
    ),
  }));
}
