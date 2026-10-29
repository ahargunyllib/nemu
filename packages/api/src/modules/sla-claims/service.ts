import {
  approvalRoute,
  calculateClaimCutoff,
  calculateSlaCompensation,
  guardRcaEvidence,
  mergeIntervals,
  type SlaClaimContext,
} from "@nemu/ai";

import { SLA_CLAIM_SEED_TASKS } from "./demo-seed";
import type {
  SlaClaimRecord,
  SlaClaimRepository,
  SlaTaskRecord,
  SlaUserRecord,
} from "./repository";

function requireRecord<T>(record: T | undefined, message: string): T {
  if (!record) throw new Error(message);
  return record;
}

export async function getSlaClaimContext(
  repository: SlaClaimRepository,
  workspaceId: string,
  claimId: string,
): Promise<SlaClaimContext> {
  const claim = requireRecord(
    await repository.findClaim(workspaceId, claimId),
    `SLA claim ${claimId} was not found in workspace ${workspaceId}`,
  );
  const [service, invoice, tickets, approvalRules, task] = await Promise.all([
    repository.findService(workspaceId, claim.serviceId),
    repository.findInvoice(workspaceId, claim.invoiceId),
    repository.listTickets(workspaceId, claim.serviceId, claim.period),
    repository.listApprovalRules(workspaceId),
    repository.findTask(workspaceId, claim.id),
  ]);

  const storedService = requireRecord(
    service,
    `Service ${claim.serviceId} for SLA claim ${claim.id} was not found`,
  );
  const storedInvoice = requireRecord(
    invoice,
    `Invoice ${claim.invoiceId} for SLA claim ${claim.id} was not found`,
  );
  const storedTask = requireRecord(task, `Task for SLA claim ${claim.id} was not found`);
  if (approvalRules.length === 0) {
    throw new Error(`Approval rules for workspace ${workspaceId} were not found`);
  }

  return {
    workspaceId,
    claim: {
      id: claim.id,
      serviceId: claim.serviceId,
      period: claim.period,
      receivedAt: claim.receivedAt,
      claimedMinutes: claim.claimedMinutes,
      invoiceId: claim.invoiceId,
    },
    service: {
      contractId: storedService.contractId,
      addendumId: storedService.addendumId,
      effectiveSlaBasisPoints: storedService.effectiveSlaBasisPoints,
    },
    invoice: { monthlyFeeIdr: storedInvoice.monthlyFeeIdr },
    tickets: tickets.map((ticket) => ({
      id: ticket.id,
      start: ticket.startedAt,
      end: ticket.recoveredAt,
      cause: ticket.cause,
      rcaId: ticket.rcaId,
      rcaStatus: ticket.rcaStatus,
    })),
    approvalRules: approvalRules.map((rule) => ({
      minimumAmount: rule.minimumAmount,
      approvers: rule.approvers,
    })),
    task: { reviewDueOn: storedTask.reviewDueOn },
  };
}

function periodMinutes(period: string): number {
  const match = period.match(/^(\d{4})-(\d{2})$/u);
  if (!match) throw new Error("Claim period must be YYYY-MM");
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) throw new Error("Claim period is not a calendar month");
  return new Date(Date.UTC(year, month, 0)).getUTCDate() * 24 * 60;
}

function ticketEvidence(context: SlaClaimContext) {
  const evidence = guardRcaEvidence(
    context.tickets.map((ticket) => ({
      ticketId: ticket.id,
      rcaStatus:
        ticket.rcaStatus === "DISAHKAN" ? "approved" : ticket.rcaId ? "pending" : "missing",
      relevant:
        ticket.rcaStatus !== "DISAHKAN" ||
        !["DAYA_PELANGGAN", "PERANGKAT_PELANGGAN"].includes(ticket.cause),
    })),
  );
  const counted = context.tickets.filter(
    (ticket) => ticket.cause === "PENYEDIA" && ticket.rcaStatus === "DISAHKAN",
  );
  const excludedTicketIds = context.tickets
    .filter(
      (ticket) =>
        ["DAYA_PELANGGAN", "PERANGKAT_PELANGGAN"].includes(ticket.cause) &&
        ticket.rcaStatus === "DISAHKAN",
    )
    .map((ticket) => ticket.id);
  const merged = mergeIntervals(
    counted.map((ticket) => ({ start: ticket.start, end: ticket.end })),
  );
  return {
    missingTicketIds: evidence.missingTicketIds,
    excludedTicketIds,
    actualDowntimeMinutes: merged.reduce((sum, interval) => sum + interval.durationMinutes, 0),
  };
}

export type SlaClaimSummary = {
  cutoff: ReturnType<typeof calculateClaimCutoff>;
  totalPeriodMinutes: number;
  allowedDowntimeMinutes: number;
  actualDowntimeMinutes: number;
  compensationAmount: number | null;
  missingTicketIds: string[];
  excludedTicketIds: string[];
  approvers: string[];
};

export function summarizeSlaClaim(context: SlaClaimContext): SlaClaimSummary {
  const cutoff = calculateClaimCutoff(context.claim.period, context.claim.receivedAt);
  const evidence = ticketEvidence(context);
  const totalPeriodMinutes = periodMinutes(context.claim.period);
  const compensation = calculateSlaCompensation({
    totalPeriodMinutes,
    slaBasisPoints: context.service.effectiveSlaBasisPoints,
    actualDowntimeMinutes: evidence.actualDowntimeMinutes,
    monthlyFee: context.invoice.monthlyFeeIdr,
  });
  const compensationAmount = evidence.missingTicketIds.length === 0 ? compensation.amount : null;
  return {
    cutoff,
    totalPeriodMinutes,
    allowedDowntimeMinutes: compensation.allowedDowntimeMinutes,
    actualDowntimeMinutes: evidence.actualDowntimeMinutes,
    compensationAmount,
    missingTicketIds: evidence.missingTicketIds,
    excludedTicketIds: evidence.excludedTicketIds,
    approvers:
      compensationAmount === null ? [] : approvalRoute(compensationAmount, context.approvalRules),
  };
}

export class SlaClaimNotFoundError extends Error {}

export class SlaClaimAccessError extends Error {}

export type SlaClaimActor = { id: string };

/** How MP-BILL-02 names an approver: "Sari Wulandari (Supervisor Billing)". */
function approverName(user: SlaUserRecord): string {
  return `${user.name} (${user.role})`;
}

async function approvalRouteOf(
  repository: SlaClaimRepository,
  workspaceId: string,
  claimId: string,
): Promise<string[]> {
  return summarizeSlaClaim(await getSlaClaimContext(repository, workspaceId, claimId)).approvers;
}

// A claim Task belongs to its assignee. At Persetujuan the approvers on its route see it too, and
// each keeps it after approving, so the approver who closes the route still sees the Credit Note.
async function canSeeTask(
  repository: SlaClaimRepository,
  workspaceId: string,
  task: SlaTaskRecord,
  actorId: string,
  approver: string | undefined,
): Promise<boolean> {
  if (task.assigneeId === actorId || task.approvedBy.includes(actorId)) return true;
  if (task.name !== "Persetujuan" || !approver) return false;
  return (await approvalRouteOf(repository, workspaceId, task.claimId)).includes(approver);
}

/** Whether it is `approver`'s turn on the route. The assignee never approves its own claim (SOP Pasal 8). */
function isApproversTurn(
  task: SlaTaskRecord,
  approvers: readonly string[],
  actorId: string,
  approver: string | undefined,
): boolean {
  return (
    task.name === "Persetujuan" &&
    task.assigneeId !== actorId &&
    approver !== undefined &&
    approvers[task.approvedBy.length] === approver
  );
}

async function approverOf(
  repository: Pick<SlaClaimRepository, "findUser">,
  workspaceId: string,
  actorId: string,
): Promise<string | undefined> {
  const user = await repository.findUser(workspaceId, actorId);
  return user && approverName(user);
}

export async function listSlaClaimTasks(
  repository: SlaClaimRepository,
  workspaceId: string,
  actorId: string,
): Promise<SlaTaskRecord[]> {
  const [tasks, approver] = await Promise.all([
    repository.listWorkspaceTasks(workspaceId),
    approverOf(repository, workspaceId, actorId),
  ]);
  const visible = await Promise.all(
    tasks.map((task) => canSeeTask(repository, workspaceId, task, actorId, approver)),
  );
  return tasks.filter((_, index) => visible[index]);
}

export async function listSlaClaims(
  repository: SlaClaimRepository,
  workspaceId: string,
  actorId: string,
): Promise<SlaClaimRecord[]> {
  const [claims, tasks] = await Promise.all([
    repository.listClaims(workspaceId),
    listSlaClaimTasks(repository, workspaceId, actorId),
  ]);
  const claimIds = new Set(tasks.map((task) => task.claimId));
  return claims.filter((claim) => claimIds.has(claim.id));
}

// An unknown claim and a claim the actor may not see fail the same way, before any state check,
// so the response never reveals which claims exist.
async function findVisibleTask(
  repository: SlaClaimRepository,
  workspaceId: string,
  claimId: string,
  actorId: string,
): Promise<{ task: SlaTaskRecord; approver: string | undefined }> {
  const [task, approver] = await Promise.all([
    repository.findTask(workspaceId, claimId),
    approverOf(repository, workspaceId, actorId),
  ]);
  if (!task || !(await canSeeTask(repository, workspaceId, task, actorId, approver))) {
    throw new SlaClaimNotFoundError(`Klaim SLA ${claimId} tidak ditemukan`);
  }
  return { task, approver };
}

export async function getSlaClaimDetail(
  repository: SlaClaimRepository,
  workspaceId: string,
  claimId: string,
  actorId: string,
) {
  const { task, approver } = await findVisibleTask(repository, workspaceId, claimId, actorId);
  const [context, claimRecord, assignee] = await Promise.all([
    getSlaClaimContext(repository, workspaceId, claimId),
    repository.findClaim(workspaceId, claimId),
    repository.findUser(workspaceId, task.assigneeId),
  ]);
  const claim = requireRecord(
    claimRecord,
    `SLA claim ${claimId} was not found in workspace ${workspaceId}`,
  );
  const summary = summarizeSlaClaim(context);
  return {
    context,
    task,
    claim,
    summary,
    assignee: assignee?.name ?? task.assigneeId,
    canAdvance: task.assigneeId === actorId && task.name !== "Persetujuan",
    canApprove: isApproversTurn(task, summary.approvers, actorId, approver),
  };
}

const NEXT_TASK = new Map([
  ["Cocokkan Layanan & Kontrak", "Telaah Tiket Gangguan"],
  ["Telaah Tiket Gangguan", "Susun Berita Acara"],
  ["Susun Berita Acara", "Persetujuan"],
  ["Persetujuan", "Credit Note"],
]);

// Persetujuan follows MP-BILL-02: each approver on the route approves in turn, and the last
// approval moves the claim to Credit Note.
async function approveSlaClaim(
  repository: SlaClaimRepository,
  workspaceId: string,
  task: SlaTaskRecord,
  actorId: string,
  approver: string | undefined,
): Promise<SlaTaskRecord> {
  if (task.assigneeId === actorId) {
    throw new SlaClaimAccessError(
      "Billing Liaison tidak boleh menyetujui klaim yang disusunnya sendiri",
    );
  }
  const approvers = await approvalRouteOf(repository, workspaceId, task.claimId);
  if (!isApproversTurn(task, approvers, actorId, approver)) {
    throw new SlaClaimAccessError(
      `Klaim ${task.claimId} menunggu persetujuan ${approvers[task.approvedBy.length] ?? "penyetuju"}`,
    );
  }
  const approvedBy = [...task.approvedBy, actorId];
  return requireRecord(
    await repository.updateTask(workspaceId, task.id, {
      name:
        approvedBy.length === approvers.length
          ? (NEXT_TASK.get(task.name) ?? task.name)
          : task.name,
      status: "OPEN",
      approvedBy,
    }),
    `Task ${task.id} could not be updated`,
  );
}

export async function advanceSlaClaimTask(
  repository: SlaClaimRepository,
  workspaceId: string,
  claimId: string,
  actor: SlaClaimActor,
): Promise<SlaTaskRecord> {
  const { task, approver } = await findVisibleTask(repository, workspaceId, claimId, actor.id);
  if (task.name === "Persetujuan") {
    return approveSlaClaim(repository, workspaceId, task, actor.id, approver);
  }
  if (task.assigneeId !== actor.id) {
    throw new SlaClaimAccessError(`Task ${task.name} klaim ${claimId} milik assignee-nya`);
  }
  const context = await getSlaClaimContext(repository, workspaceId, claimId);
  let name = NEXT_TASK.get(task.name) ?? task.name;
  let status = "OPEN";

  if (task.name === "Registrasi Klaim") {
    name = calculateClaimCutoff(context.claim.period, context.claim.receivedAt).timely
      ? "Cocokkan Layanan & Kontrak"
      : "Surat Penolakan";
  } else if (
    task.name === "Telaah Tiket Gangguan" &&
    ticketEvidence(context).missingTicketIds.length > 0
  ) {
    name = task.name;
    status = "PERLU_BUKTI";
  } else if (task.name === "Credit Note" || task.name === "Surat Penolakan") {
    name = task.name;
    status = "SELESAI";
  }

  return requireRecord(
    await repository.updateTask(workspaceId, task.id, { name, status }),
    `Task ${task.id} could not be updated`,
  );
}

/** The demo panel's reset: every seeded claim Task back at Registrasi Klaim, with no approvals. */
export function resetSlaClaimTasks(
  repository: Pick<SlaClaimRepository, "replaceTasks">,
): Promise<void> {
  return repository.replaceTasks("W-TELKO", SLA_CLAIM_SEED_TASKS);
}
