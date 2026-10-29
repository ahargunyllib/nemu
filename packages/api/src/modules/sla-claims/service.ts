import {
  approvalRoute,
  calculateClaimCutoff,
  calculateSlaCompensation,
  guardRcaEvidence,
  mergeIntervals,
  type SlaClaimContext,
} from "@nemu/ai";

import type { SlaClaimRecord, SlaClaimRepository, SlaTaskRecord } from "./repository";

export function listSlaClaims(
  repository: Pick<SlaClaimRepository, "listClaims">,
  workspaceId: string,
  assigneeId: string,
): Promise<SlaClaimRecord[]> {
  return repository.listClaims(workspaceId, assigneeId);
}

export function listSlaClaimTasks(
  repository: Pick<SlaClaimRepository, "listTasks">,
  workspaceId: string,
  assigneeId: string,
): Promise<SlaTaskRecord[]> {
  return repository.listTasks(workspaceId, assigneeId);
}

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

// An unknown claim and another assignee's claim fail the same way, before any
// state check, so the response never reveals which claims exist.
async function findAssignedTask(
  repository: Pick<SlaClaimRepository, "findTask">,
  workspaceId: string,
  claimId: string,
  actorId: string,
): Promise<SlaTaskRecord> {
  const task = await repository.findTask(workspaceId, claimId);
  if (!task || task.assigneeId !== actorId) {
    throw new SlaClaimNotFoundError(`Klaim SLA ${claimId} tidak ditemukan`);
  }
  return task;
}

export async function getSlaClaimDetail(
  repository: SlaClaimRepository,
  workspaceId: string,
  claimId: string,
  actorId: string,
) {
  const task = await findAssignedTask(repository, workspaceId, claimId, actorId);
  const [context, claimRecord] = await Promise.all([
    getSlaClaimContext(repository, workspaceId, claimId),
    repository.findClaim(workspaceId, claimId),
  ]);
  const claim = requireRecord(
    claimRecord,
    `SLA claim ${claimId} was not found in workspace ${workspaceId}`,
  );
  return { context, task, claim, summary: summarizeSlaClaim(context) };
}

const NEXT_TASK = new Map([
  ["Cocokkan Layanan & Kontrak", "Telaah Tiket Gangguan"],
  ["Telaah Tiket Gangguan", "Susun Berita Acara"],
  ["Susun Berita Acara", "Persetujuan"],
  ["Persetujuan", "Credit Note"],
]);

export type SlaClaimActor = { id: string };

export class SlaClaimAccessError extends Error {}

export async function advanceSlaClaimTask(
  repository: SlaClaimRepository,
  workspaceId: string,
  claimId: string,
  actor: SlaClaimActor,
): Promise<SlaTaskRecord> {
  const task = await findAssignedTask(repository, workspaceId, claimId, actor.id);
  if (task.name === "Persetujuan") {
    throw new SlaClaimAccessError(
      `Claim ${claimId} requires the dedicated approval workflow with stable approver identities`,
    );
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
