import { expect, test } from "vite-plus/test";

import type { SlaClaimRepository } from "./repository";
import {
  advanceSlaClaimTask,
  getSlaClaimContext,
  getSlaClaimDetail,
  listSlaClaims,
  SlaClaimNotFoundError,
  summarizeSlaClaim,
} from "./service";

const BILLING_LIAISON = { id: "U-101" };

function repository(): SlaClaimRepository {
  return {
    async listClaims(_workspaceId, _assigneeId) {
      return [
        {
          id: "KLM-2610-0007",
          workspaceId: "W-TELKO",
          fixture: "C01",
          customer: "PT Arunika Retail",
          letterNumber: "ARN/IT/118/X/2026",
          serviceId: "TN-ENT-002",
          period: "2026-09",
          letterDate: "2026-10-06",
          receivedAt: "2026-10-08T14:12:00+07:00",
          claimedMinutes: 1_530,
          invoiceId: "INV-2609-0042",
          notes: "Kasus utama demo",
        },
      ];
    },
    async findClaim() {
      return (await this.listClaims("W-TELKO", "U-101"))[0];
    },
    async findService() {
      return {
        id: "TN-ENT-002",
        workspaceId: "W-TELKO",
        customer: "PT Arunika Retail",
        location: "Gudang distribusi, Cikarang",
        product: "Internet Dedicated",
        bandwidthMbps: 100,
        monthlyFeeIdr: 30_000_000,
        contractId: "KON-2026-01",
        addendumId: "ADD-2026-02",
        baseSlaBasisPoints: 9_900,
        effectiveSlaBasisPoints: 9_950,
        activeSince: "2026-09-01",
      };
    },
    async findInvoice() {
      return {
        id: "INV-2609-0042",
        workspaceId: "W-TELKO",
        serviceId: "TN-ENT-002",
        period: "2026-09",
        monthlyFeeIdr: 30_000_000,
        otherTaxBaseIdr: 27_500_000,
        vatIdr: 3_300_000,
        totalIdr: 33_300_000,
        issuedOn: "2026-10-01",
        status: "LUNAS",
      };
    },
    async listTickets() {
      return [
        {
          id: "INC-2609-014",
          workspaceId: "W-TELKO",
          serviceId: "TN-ENT-002",
          startedAt: "2026-09-03T08:00:00+07:00",
          recoveredAt: "2026-09-03T20:00:00+07:00",
          durationMinutes: 720,
          cause: "PENYEDIA",
          rcaId: "RCA-2609-07",
          rcaStatus: "DISAHKAN",
          reporter: "IT gudang",
          summary: "Kabel putus",
        },
      ];
    },
    async listApprovalRules() {
      return [
        {
          id: "MP-BILL-02-1",
          workspaceId: "W-TELKO",
          minimumAmount: 0,
          approvers: ["Sari Wulandari (Supervisor Billing)"],
        },
      ];
    },
    async findTask() {
      return {
        id: "T-0007-1",
        workspaceId: "W-TELKO",
        claimId: "KLM-2610-0007",
        name: "Registrasi Klaim",
        assigneeId: "U-101",
        createdAt: "2026-10-08T14:20:00+07:00",
        reviewDueOn: "2026-10-15",
        status: "OPEN",
      };
    },
    async listTasks(_workspaceId, _assigneeId) {
      return [(await this.findTask("W-TELKO", "KLM-2610-0007"))!];
    },
    async findAssignedTaskByService() {
      return this.findTask("W-TELKO", "KLM-2610-0007");
    },
    async findAssignedTaskByInvoice() {
      return this.findTask("W-TELKO", "KLM-2610-0007");
    },
    async updateTask(_workspaceId, taskId, update) {
      return { ...(await this.findTask("W-TELKO", "KLM-2610-0007"))!, id: taskId, ...update };
    },
  };
}

test("lists claims within the selected workspace", async () => {
  await expect(listSlaClaims(repository(), "W-TELKO", "U-101")).resolves.toHaveLength(1);
});

test("summarizes exact decimal SLA calculations from stored facts", async () => {
  const context = await getSlaClaimContext(repository(), "W-TELKO", "KLM-2610-0007");

  expect(summarizeSlaClaim(context)).toMatchObject({
    cutoff: { deadline: "2026-10-15", timely: true },
    totalPeriodMinutes: 43_200,
    allowedDowntimeMinutes: 216,
    actualDowntimeMinutes: 720,
    compensationAmount: 350_000,
    missingTicketIds: [],
    approvers: ["Sari Wulandari (Supervisor Billing)"],
  });
});

test.each([
  ["KLM-2610-0007", "Registrasi Klaim", "OPEN", true, "Cocokkan Layanan & Kontrak", "OPEN"],
  ["KLM-2610-0011", "Registrasi Klaim", "OPEN", false, "Surat Penolakan", "OPEN"],
  ["KLM-2610-0007", "Cocokkan Layanan & Kontrak", "OPEN", true, "Telaah Tiket Gangguan", "OPEN"],
  ["KLM-2610-0009", "Telaah Tiket Gangguan", "OPEN", true, "Telaah Tiket Gangguan", "PERLU_BUKTI"],
  ["KLM-2610-0007", "Telaah Tiket Gangguan", "OPEN", true, "Susun Berita Acara", "OPEN"],
  ["KLM-2610-0007", "Susun Berita Acara", "OPEN", true, "Persetujuan", "OPEN"],
  ["KLM-2610-0007", "Credit Note", "OPEN", true, "Credit Note", "SELESAI"],
] as const)(
  "advances %s from %s through a server-owned transition",
  async (claimId, name, status, evidenceReady, expectedName, expectedStatus) => {
    const fake = repository();
    fake.findTask = async () => ({
      ...(await repository().findTask("W-TELKO", claimId))!,
      claimId,
      name,
      status,
    });
    fake.findClaim = async () => ({
      ...(await repository().findClaim("W-TELKO", claimId))!,
      id: claimId,
      receivedAt: evidenceReady ? "2026-10-08T14:12:00+07:00" : "2026-10-08T14:12:00+07:00",
    });
    if (!evidenceReady) {
      const record = await fake.findClaim("W-TELKO", claimId);
      fake.findClaim = async () => ({ ...record!, period: "2026-08" });
    }
    if (claimId === "KLM-2610-0009") {
      fake.listTickets = async () => [
        {
          ...(await repository().listTickets("W-TELKO", "TN-ENT-002", "2026-09"))[0]!,
          id: "INC-2609-058",
          rcaId: null,
          rcaStatus: "BELUM_ADA",
        },
      ];
    }

    await expect(
      advanceSlaClaimTask(fake, "W-TELKO", claimId, BILLING_LIAISON),
    ).resolves.toMatchObject({
      name: expectedName,
      status: expectedStatus,
    });
  },
);

test("rejects a Billing Liaison advancing a claim through approval", async () => {
  const fake = repository();
  fake.findTask = async () => ({
    ...(await repository().findTask("W-TELKO", "KLM-2610-0007"))!,
    name: "Persetujuan",
  });

  await expect(
    advanceSlaClaimTask(fake, "W-TELKO", "KLM-2610-0007", BILLING_LIAISON),
  ).rejects.toThrow("dedicated approval workflow");
});

function unknownClaim(): SlaClaimRepository {
  const fake = repository();
  fake.findClaim = async () => undefined;
  fake.findTask = async () => undefined;
  return fake;
}

function otherAssigneesClaim(name = "Registrasi Klaim"): SlaClaimRepository {
  const fake = repository();
  fake.findTask = async () => ({
    ...(await repository().findTask("W-TELKO", "KLM-2610-0007"))!,
    name,
    assigneeId: "U-202",
  });
  return fake;
}

const procedures = [
  [
    "reading",
    (fake: SlaClaimRepository, claimId: string) =>
      getSlaClaimDetail(fake, "W-TELKO", claimId, BILLING_LIAISON.id),
  ],
  [
    "advancing",
    (fake: SlaClaimRepository, claimId: string) =>
      advanceSlaClaimTask(fake, "W-TELKO", claimId, BILLING_LIAISON),
  ],
] as const;

test.each(
  procedures.flatMap(([action, run]) => [
    [action, "an unknown claim", run, unknownClaim()],
    [action, "another assignee's claim", run, otherAssigneesClaim()],
    [action, "another assignee's claim at Persetujuan", run, otherAssigneesClaim("Persetujuan")],
  ]),
)("hides %s %s behind the same not-found error", async (_action, _case, run, fake) => {
  const result = run(fake, "KLM-2610-0007");

  await expect(result).rejects.toBeInstanceOf(SlaClaimNotFoundError);
  await expect(result).rejects.toThrow("Klaim SLA KLM-2610-0007 tidak ditemukan");
});

test("builds the plain AI claim context from repository facts", async () => {
  await expect(getSlaClaimContext(repository(), "W-TELKO", "KLM-2610-0007")).resolves.toMatchObject(
    {
      workspaceId: "W-TELKO",
      claim: { id: "KLM-2610-0007", claimedMinutes: 1_530 },
      service: { effectiveSlaBasisPoints: 9_950 },
      invoice: { monthlyFeeIdr: 30_000_000 },
      tickets: [{ id: "INC-2609-014", rcaStatus: "DISAHKAN" }],
      approvalRules: [{ minimumAmount: 0 }],
      task: { reviewDueOn: "2026-10-15" },
    },
  );
});

test("fails clearly instead of inventing a missing stored claim", async () => {
  const fake = repository();
  fake.findClaim = async () => undefined;

  await expect(getSlaClaimContext(fake, "W-TELKO", "missing")).rejects.toThrow(
    "SLA claim missing was not found in workspace W-TELKO",
  );
});
