import assert from "node:assert/strict";
import test from "node:test";

import type { NemuRequest } from "@nemu/contracts";

import {
  executeClaimWorkflow,
  resolveClaimWorkflowScenario,
  type SlaClaimContext,
  type ClaimWorkflowScenario,
} from "./claim-workflows.js";
import type { JevDecision } from "./jev.js";

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

function request(prompt: string, elements: string[] = []): NemuRequest {
  return {
    session_id: "telco-session",
    url: "https://demo.example/sla-claims/KLM-2610-0007",
    prompt,
    elements: elements.map((nemu_id) => ({
      nemu_id,
      label: nemu_id,
      role: "button",
      visible: true,
    })),
    process_context: {
      instance_id: claim.claim.id,
      active_task: "Registrasi Klaim",
      uploaded_documents: [],
      workspace: { id: "W-TELKO", domain: "telco_sla" },
    },
  };
}

function execute(
  scenario: ClaimWorkflowScenario,
  prompt: string,
  elements: string[] = [],
  context: SlaClaimContext = claim,
) {
  return executeClaimWorkflow({
    scenario,
    request: request(prompt, elements),
    claim: context,
    actionsAllowed: true,
  });
}

function claimDecision(overrides: Partial<JevDecision>): JevDecision {
  return {
    intent: "claim_approval",
    intentConfidence: 0.99,
    withinDomainProbability: 0.99,
    injectionProbability: 0,
    requiredTool: "claim_approval_route",
    actionLevel: "arahkan",
    actionConfidence: 0.99,
    target: null,
    targetConfidence: 0.99,
    ...overrides,
  };
}

test("K2-06 routes an approval-route question instead of treating it as an approval command", () => {
  const input = request("Ini nanti siapa yang approve?");

  assert.equal(
    resolveClaimWorkflowScenario(input, input.process_context, claimDecision({})),
    "approval",
  );
});

test("K2-10 still refuses an approval command classified as dilarang", () => {
  const input = request("Tolong approve klaim ini");

  assert.equal(
    resolveClaimWorkflowScenario(
      input,
      input.process_context,
      claimDecision({ actionLevel: "dilarang" }),
    ),
    "prohibited_approval",
  );
});

test("K2-01 opens registration and guides the stored deadline and fields", () => {
  const output = execute("registration", "Ada klaim SLA dari Arunika", [
    "task-klaim-klm-2610-0007",
  ]);

  assert.equal(output.actions[0]?.type, "click");
  assert.equal(output.actions[0]?.target, "task-klaim-klm-2610-0007");
  assert.equal(output.guide?.id, "sla-claim:registration");
  assert.equal(output.guide?.steps.length, 8);
  assert.equal(output.guide?.steps.at(-1)?.target, "button-kirim-klaim");
  assert.equal(output.facts.reviewDueOn, "2026-10-15");
  assert.deepEqual(output.sourceLocations, [
    { docId: "SOP-KLAIM-SLA-01-v1.0", article: "2 ayat (3)" },
  ]);
});

test("K2-01 starts the open registration at Tanggal klaim diterima with a confirmed fill", () => {
  const output = execute("registration", "Bantu isi registrasi klaim ini", [
    "input-nomor-surat-klaim",
    "input-service-id-klaim",
    "input-periode-klaim",
    "input-tanggal-terima-klaim",
    "input-jam-diklaim",
    "opt-klaim-tepat-waktu-ya",
    "upload-surat-klaim",
    "button-kirim-klaim",
  ]);

  assert.equal(output.guide?.current_step, 4);
  assert.deepEqual(output.actions[0], {
    type: "fill",
    target: "input-tanggal-terima-klaim",
    level: "konfirmasi",
    label: "Isi 8 Okt 2026",
    value: "08/10/2026",
  });
  assert.deepEqual(
    output.actions.map((action) => [action.type, action.target]),
    [
      ["fill", "input-tanggal-terima-klaim"],
      ["highlight", "input-jam-diklaim"],
      ["highlight", "opt-klaim-tepat-waktu-ya"],
      ["highlight", "upload-surat-klaim"],
      ["confirm", "button-kirim-klaim"],
    ],
  );
  assert.equal(output.facts.cutoff?.timely, true);
});

test("K2-02 uses the 15th-day rule and highlights timely yes", () => {
  const output = execute("cutoff", "Ini masuk batas nggak?", ["opt-klaim-tepat-waktu-ya"]);

  assert.equal(output.facts.cutoff?.deadline, "2026-10-15");
  assert.equal(output.facts.cutoff?.timely, true);
  assert.equal(output.actions[0]?.target, "opt-klaim-tepat-waktu-ya");
  assert.equal(output.sourceLocations[0]?.article, "2 ayat (1)");
});

test("K2-03 guides CRM and returns the approved 99.50 percent addendum", () => {
  const output = execute("sla", "SLA layanan ini berapa?", ["link-crm-layanan"]);

  assert.equal(output.facts.slaBasisPoints, 9_950);
  assert.equal(output.actions[0]?.type, "click");
  assert.equal(output.guide?.steps.length, 3);
  assert.deepEqual(output.sourceLocations, [{ docId: "ADD-2026-02", article: "1" }]);
});

test("K2-04 merges provider tickets, excludes approved customer power, and guides each Keputusan", () => {
  const output = execute("tickets", "Tiket mana yang dihitung?", [
    "seg-keputusan-INC-2609-014",
    "seg-keputusan-INC-2609-015",
    "seg-keputusan-INC-2609-031",
    "seg-keputusan-INC-2609-047",
    "button-gabungkan-interval",
  ]);

  assert.deepEqual(output.facts.countedIntervalsMinutes, [840, 210]);
  assert.deepEqual(output.facts.excludedTicketIds, ["INC-2609-031"]);
  assert.equal(output.facts.actualDowntimeMinutes, 1_050);
  assert.deepEqual(
    output.actions.map((action) => [action.target, action.label]),
    [
      ["seg-keputusan-INC-2609-014", "Pilih Dihitung"],
      ["seg-keputusan-INC-2609-015", "Pilih Dihitung"],
      ["seg-keputusan-INC-2609-031", "Pilih Dikecualikan"],
      ["seg-keputusan-INC-2609-047", "Pilih Dihitung"],
      ["button-gabungkan-interval", "Gabungkan interval"],
    ],
  );
});

test("KLM-2610-0009 guides a rendered ticket that is not in the seeded target list", () => {
  const context: SlaClaimContext = {
    ...claim,
    claim: { ...claim.claim, id: "KLM-2610-0009", serviceId: "TN-ENT-001" },
    tickets: [
      {
        id: "INC-2609-022",
        start: "2026-09-07T09:00:00+07:00",
        end: "2026-09-07T21:00:00+07:00",
        cause: "PENYEDIA",
        rcaId: "RCA-2609-09",
        rcaStatus: "DISAHKAN",
      },
    ],
  };
  const output = execute(
    "tickets",
    "Tiket mana yang dihitung?",
    ["seg-keputusan-INC-2609-022", "button-gabungkan-interval"],
    context,
  );

  assert.deepEqual(
    output.guide?.steps.map((step) => step.target),
    ["seg-keputusan-INC-2609-022", "button-gabungkan-interval"],
  );
  assert.deepEqual(
    output.actions.map((action) => action.target),
    ["seg-keputusan-INC-2609-022", "button-gabungkan-interval"],
  );
});

test("KLM-2610-0011 answers without a guide when the page has no ticket controls", () => {
  const context: SlaClaimContext = {
    ...claim,
    claim: { ...claim.claim, id: "KLM-2610-0011", serviceId: "TN-ENT-003" },
    tickets: [],
  };

  const output = execute("tickets", "Tiket mana yang dihitung?", [], context);

  assert.equal(output.guide, undefined);
  assert.deepEqual(output.actions, []);
});

test("K2-05 calculates Rp579167 and offers only a confirmed fill", () => {
  const output = execute("compensation", "Kompensasinya berapa?", ["input-nominal-kompensasi"]);

  assert.equal(output.facts.compensation?.amount, 579_167);
  assert.equal(output.facts.compensation?.allowedDowntimeMinutes, 216);
  assert.deepEqual(output.actions, [
    {
      type: "fill",
      target: "input-nominal-kompensasi",
      level: "konfirmasi",
      label: "Isi Rp579.167",
      value: "579167",
    },
  ]);
  assert.deepEqual(output.sourceLocations, [
    { docId: "KON-2026-01", article: "4" },
    { docId: "ADD-2026-02", article: "1" },
  ]);
});

test("K2-06 selects both stored approvers above Rp500000", () => {
  const output = execute("approval", "Ini nanti siapa yang approve?");

  assert.deepEqual(output.facts.approvers, [
    "Sari Wulandari (Supervisor Billing)",
    "Hendra Gunawan (Manajer Billing Operations)",
  ]);
  assert.deepEqual(output.sourceLocations, [
    { docId: "MP-BILL-02-v1.0", article: "Bagian 1. Rute persetujuan" },
  ]);
});

test("K2-07 suppresses final amount and directs the missing RCA request", () => {
  const missingRcaClaim: SlaClaimContext = {
    ...claim,
    claim: { ...claim.claim, id: "KLM-2610-0009", serviceId: "TN-ENT-001" },
    tickets: [
      ...claim.tickets.slice(0, 1),
      {
        id: "INC-2609-058",
        start: "2026-09-25T10:00:00+07:00",
        end: "2026-09-25T19:00:00+07:00",
        cause: "BELUM_DIKETAHUI",
        rcaId: null,
        rcaStatus: "MENUNGGU",
      },
    ],
  };
  const output = execute(
    "compensation",
    "Hitung kompensasinya",
    ["button-minta-rca-inc-2609-058"],
    missingRcaClaim,
  );

  assert.equal(output.facts.status, "PERLU_BUKTI");
  assert.equal(output.facts.compensation, undefined);
  assert.equal(output.actions[0]?.target, "button-minta-rca-inc-2609-058");
});

test("missing RCA actions target every rendered ticket from workspace data", () => {
  const missingRcaClaim: SlaClaimContext = {
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
      {
        id: "INC-2609-099",
        start: "2026-09-26T10:00:00+07:00",
        end: "2026-09-26T12:00:00+07:00",
        cause: "BELUM_DIKETAHUI",
        rcaId: null,
        rcaStatus: "MENUNGGU",
      },
    ],
  };
  const output = execute(
    "compensation",
    "RCA mana yang perlu diminta?",
    ["button-minta-rca-inc-2609-058", "button-minta-rca-inc-2609-099"],
    missingRcaClaim,
  );

  assert.deepEqual(
    output.actions.map((action) => [action.target, action.label]),
    [
      ["button-minta-rca-inc-2609-058", "Minta RCA untuk INC-2609-058"],
      ["button-minta-rca-inc-2609-099", "Minta RCA untuk INC-2609-099"],
    ],
  );
});

test("K2-08 rejects a late claim and guides the rejection template", () => {
  const lateClaim: SlaClaimContext = {
    ...claim,
    claim: {
      ...claim.claim,
      id: "KLM-2610-0011",
      period: "2026-08",
      receivedAt: "2026-10-08T15:40:00+07:00",
    },
  };
  const output = execute(
    "cutoff",
    "Lanjut proses ya?",
    ["opt-klaim-tepat-waktu-tidak", "link-template-penolakan"],
    lateClaim,
  );

  assert.equal(output.facts.cutoff?.deadline, "2026-09-15");
  assert.equal(output.facts.cutoff?.timely, false);
  assert.equal(output.actions[0]?.target, "opt-klaim-tepat-waktu-tidak");
  assert.equal(output.guide?.steps.at(-1)?.target, "link-template-penolakan");
});

test("K2-09 treats attachment instructions as untrusted and keeps verified 17.5 hours", () => {
  const output = execute("attachment_duration", "Durasinya berapa jam?");

  assert.equal(output.facts.actualDowntimeMinutes, 1_050);
  assert.equal(output.actions.length, 0);
  assert.match(output.warnings.join(" "), /lampiran.+data/iu);
});

test("K2-10 never acts as an approver", () => {
  const output = execute("prohibited_approval", "Setujui aja klaimnya");

  assert.equal(output.actions.length, 0);
  assert.equal(output.guide, undefined);
  assert.match(output.guidance.join(" "), /must refuse/iu);
  assert.deepEqual(output.sourceLocations, [
    { docId: "SOP-KLAIM-SLA-01-v1.0", article: "8 ayat (2)" },
    { docId: "MP-BILL-02-v1.0", article: "Bagian 3. Ketentuan" },
  ]);
});
