import { expect, test } from "vite-plus/test";

import type { SlaClaimRepository, SlaTaskRecord, SlaUserRecord } from "./repository";
import {
  advanceSlaClaimTask,
  getSlaClaimContext,
  getSlaClaimDetail,
  listSlaClaims,
  listSlaClaimTasks,
  SlaClaimAccessError,
  SlaClaimNotFoundError,
  summarizeSlaClaim,
} from "./service";

const BILLING_LIAISON = { id: "U-101" };
const SUPERVISOR = { id: "U-102" };
const MANAGER = { id: "U-103" };

const USERS: SlaUserRecord[] = [
  ["U-101", "Dimas Pratama", "Billing Liaison"],
  ["U-102", "Sari Wulandari", "Supervisor Billing"],
  ["U-103", "Hendra Gunawan", "Manajer Billing Operations"],
].map(([id, name, role]) => ({
  id: id!,
  workspaceId: "W-TELKO",
  name: name!,
  role: role!,
  joinedOn: "2021-03-01",
  email: `${id}@telkonusantara.example`,
}));

function repository(): SlaClaimRepository {
  return {
    async listClaims(_workspaceId) {
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
      return (await this.listClaims("W-TELKO"))[0];
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
        approvedBy: [],
      };
    },
    async listTasks(_workspaceId, _assigneeId) {
      return [(await this.findTask("W-TELKO", "KLM-2610-0007"))!];
    },
    async listWorkspaceTasks(_workspaceId) {
      return [(await this.findTask("W-TELKO", "KLM-2610-0007"))!];
    },
    async findUser(_workspaceId, userId) {
      return USERS.find((user) => user.id === userId);
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
    async replaceTasks() {},
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

/**
 * KLM-2610-0007 at Persetujuan, its Rp350.000 above a two-approver rule, with the Task stored so
 * that each approval is seen by the next call.
 */
async function claimAtApproval(approvedBy: string[] = []) {
  const fake = repository();
  let task: SlaTaskRecord = {
    ...(await repository().findTask("W-TELKO", "KLM-2610-0007"))!,
    name: "Persetujuan",
    approvedBy,
  };
  fake.findTask = async () => task;
  fake.listWorkspaceTasks = async () => [task];
  fake.updateTask = async (_workspaceId, _taskId, update) => (task = { ...task, ...update });
  fake.listApprovalRules = async () => [
    ...(await repository().listApprovalRules("W-TELKO")),
    {
      id: "MP-BILL-02-2",
      workspaceId: "W-TELKO",
      minimumAmount: 300_000,
      approvers: [
        "Sari Wulandari (Supervisor Billing)",
        "Hendra Gunawan (Manajer Billing Operations)",
      ],
    },
  ];
  return fake;
}

test("refuses the Billing Liaison approving the claim it drafted", async () => {
  const fake = await claimAtApproval();

  const result = advanceSlaClaimTask(fake, "W-TELKO", "KLM-2610-0007", BILLING_LIAISON);

  await expect(result).rejects.toBeInstanceOf(SlaClaimAccessError);
  await expect(result).rejects.toThrow("tidak boleh menyetujui klaim yang disusunnya sendiri");
  await expect(
    getSlaClaimDetail(fake, "W-TELKO", "KLM-2610-0007", BILLING_LIAISON.id),
  ).resolves.toMatchObject({ canApprove: false, canAdvance: false, assignee: "Dimas Pratama" });
});

test("approves through the route in order and then moves the claim to Credit Note", async () => {
  const fake = await claimAtApproval();

  await expect(advanceSlaClaimTask(fake, "W-TELKO", "KLM-2610-0007", MANAGER)).rejects.toThrow(
    "menunggu persetujuan Sari Wulandari (Supervisor Billing)",
  );
  await expect(
    getSlaClaimDetail(fake, "W-TELKO", "KLM-2610-0007", SUPERVISOR.id),
  ).resolves.toMatchObject({ canApprove: true, assignee: "Dimas Pratama" });

  await expect(
    advanceSlaClaimTask(fake, "W-TELKO", "KLM-2610-0007", SUPERVISOR),
  ).resolves.toMatchObject({ name: "Persetujuan", status: "OPEN", approvedBy: ["U-102"] });
  await expect(
    advanceSlaClaimTask(fake, "W-TELKO", "KLM-2610-0007", SUPERVISOR),
  ).rejects.toBeInstanceOf(SlaClaimAccessError);
  await expect(
    getSlaClaimDetail(fake, "W-TELKO", "KLM-2610-0007", MANAGER.id),
  ).resolves.toMatchObject({ canApprove: true });

  await expect(
    advanceSlaClaimTask(fake, "W-TELKO", "KLM-2610-0007", MANAGER),
  ).resolves.toMatchObject({
    name: "Credit Note",
    status: "OPEN",
    approvedBy: ["U-102", "U-103"],
  });
});

test("lets only the assignee complete the Credit Note an approver can still see", async () => {
  const fake = await claimAtApproval();
  await advanceSlaClaimTask(fake, "W-TELKO", "KLM-2610-0007", SUPERVISOR);
  await advanceSlaClaimTask(fake, "W-TELKO", "KLM-2610-0007", MANAGER);

  await expect(
    getSlaClaimDetail(fake, "W-TELKO", "KLM-2610-0007", MANAGER.id),
  ).resolves.toMatchObject({ canAdvance: false, canApprove: false });
  await expect(
    advanceSlaClaimTask(fake, "W-TELKO", "KLM-2610-0007", MANAGER),
  ).rejects.toBeInstanceOf(SlaClaimAccessError);
  await expect(
    advanceSlaClaimTask(fake, "W-TELKO", "KLM-2610-0007", BILLING_LIAISON),
  ).resolves.toMatchObject({ name: "Credit Note", status: "SELESAI" });
});

test("shows an approver only the claims waiting at Persetujuan on their route", async () => {
  await expect(listSlaClaimTasks(repository(), "W-TELKO", SUPERVISOR.id)).resolves.toEqual([]);
  await expect(listSlaClaims(repository(), "W-TELKO", SUPERVISOR.id)).resolves.toEqual([]);
  await expect(
    getSlaClaimDetail(repository(), "W-TELKO", "KLM-2610-0007", SUPERVISOR.id),
  ).rejects.toBeInstanceOf(SlaClaimNotFoundError);

  const fake = await claimAtApproval();
  await expect(listSlaClaims(fake, "W-TELKO", SUPERVISOR.id)).resolves.toMatchObject([
    { id: "KLM-2610-0007" },
  ]);
  await expect(listSlaClaimTasks(fake, "W-TELKO", MANAGER.id)).resolves.toMatchObject([
    { name: "Persetujuan" },
  ]);
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
