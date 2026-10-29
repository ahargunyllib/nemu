export type TimeInterval = { start: string; end: string };
export type MergedInterval = TimeInterval & { durationMinutes: number };

function timestamp(value: string, label: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`${label} must be an ISO date-time`);
  return parsed;
}

export function mergeIntervals(intervals: readonly TimeInterval[]): MergedInterval[] {
  const sorted = intervals
    .map((interval) => {
      const startMs = timestamp(interval.start, "Interval start");
      const endMs = timestamp(interval.end, "Interval end");
      if (endMs <= startMs) throw new Error("Interval end must be after its start");
      if ((endMs - startMs) % 60_000 !== 0) {
        throw new Error("Interval boundaries must resolve to whole minutes");
      }
      return { startMs, endMs };
    })
    .sort((left, right) => left.startMs - right.startMs || left.endMs - right.endMs);

  const merged: Array<{ startMs: number; endMs: number }> = [];
  for (const interval of sorted) {
    const previous = merged.at(-1);
    if (previous && interval.startMs <= previous.endMs) {
      previous.endMs = Math.max(previous.endMs, interval.endMs);
    } else {
      merged.push({ ...interval });
    }
  }

  return merged.map(({ startMs, endMs }) => ({
    start: new Date(startMs).toISOString(),
    end: new Date(endMs).toISOString(),
    durationMinutes: (endMs - startMs) / 60_000,
  }));
}

export type ClaimCutoffResult = {
  period: string;
  receivedDate: string;
  deadline: string;
  timely: boolean;
};

function requireIsoDate(value: string, label: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) throw new Error(`${label} must be YYYY-MM-DD`);
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error(`${label} is not a calendar date`);
  }
  return value;
}

export function calculateClaimCutoff(period: string, receivedAt: string): ClaimCutoffResult {
  const periodMatch = period.match(/^(\d{4})-(\d{2})$/u);
  if (!periodMatch) throw new Error("Claim period must be YYYY-MM");
  const year = Number(periodMatch[1]);
  const month = Number(periodMatch[2]);
  if (month < 1 || month > 12) throw new Error("Claim period is not a calendar month");
  const receivedDate = requireIsoDate(receivedAt.slice(0, 10), "Billing email date");
  if (Number.isNaN(Date.parse(receivedAt)))
    throw new Error("Billing email stamp must be an ISO date-time");
  const deadlineDate = new Date(Date.UTC(year, month, 15));
  const deadline = deadlineDate.toISOString().slice(0, 10);
  return { period, receivedDate, deadline, timely: receivedDate <= deadline };
}

export type SlaCompensationInput = {
  totalPeriodMinutes: number;
  slaBasisPoints: number;
  actualDowntimeMinutes: number;
  monthlyFee: number;
};

export type SlaCompensationResult = {
  totalPeriodMinutes: number;
  allowedDowntimeMinutes: number;
  actualDowntimeMinutes: number;
  excessDowntimeMinutes: number;
  amount: number;
  capped: boolean;
};

function requireNonNegativeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative safe integer`);
  }
}

function halfUp(numerator: bigint, denominator: bigint): bigint {
  return (numerator * 2n + denominator) / (denominator * 2n);
}

export function calculateSlaCompensation(input: SlaCompensationInput): SlaCompensationResult {
  requireNonNegativeInteger(input.totalPeriodMinutes, "Total period minutes");
  if (input.totalPeriodMinutes === 0) throw new Error("Total period minutes must be positive");
  requireNonNegativeInteger(input.slaBasisPoints, "SLA basis points");
  if (input.slaBasisPoints > 10_000) throw new Error("SLA basis points cannot exceed 10000");
  requireNonNegativeInteger(input.actualDowntimeMinutes, "Actual downtime minutes");
  requireNonNegativeInteger(input.monthlyFee, "Monthly fee");

  const basis = 10_000n;
  const total = BigInt(input.totalPeriodMinutes);
  const actual = BigInt(input.actualDowntimeMinutes);
  const fee = BigInt(input.monthlyFee);
  const allowedNumerator = total * BigInt(10_000 - input.slaBasisPoints);
  const actualNumerator = actual * basis;
  const excessNumerator =
    actualNumerator > allowedNumerator ? actualNumerator - allowedNumerator : 0n;
  const compensationNumerator = fee * excessNumerator;
  const compensationDenominator = total * basis;
  const uncapped = halfUp(compensationNumerator, compensationDenominator);
  const amount = uncapped > fee ? fee : uncapped;

  return {
    totalPeriodMinutes: input.totalPeriodMinutes,
    allowedDowntimeMinutes: Number(allowedNumerator) / 10_000,
    actualDowntimeMinutes: input.actualDowntimeMinutes,
    excessDowntimeMinutes: Number(excessNumerator) / 10_000,
    amount: Number(amount),
    capped: uncapped > fee,
  };
}

export type ApprovalRule = { minimumAmount: number; approvers: readonly string[] };

export function approvalRoute(amount: number, rules: readonly ApprovalRule[]): string[] {
  requireNonNegativeInteger(amount, "Claim amount");
  for (const rule of rules)
    requireNonNegativeInteger(rule.minimumAmount, "Approval minimum amount");
  const matching = [...rules]
    .sort((left, right) => right.minimumAmount - left.minimumAmount)
    .find((rule) => amount >= rule.minimumAmount);
  if (!matching) throw new Error(`No approval rule covers claim amount ${amount}`);
  if (matching.approvers.length === 0) throw new Error("Approval rule must name an approver");
  return [...matching.approvers];
}

export type RcaEvidence = {
  ticketId: string;
  rcaStatus: "approved" | "pending" | "missing";
  relevant?: boolean;
};

export type RcaGuardResult =
  | { status: "ready"; mayCalculateFinalAmount: true; missingTicketIds: [] }
  | { status: "needs_evidence"; mayCalculateFinalAmount: false; missingTicketIds: string[] };

export function guardRcaEvidence(evidence: readonly RcaEvidence[]): RcaGuardResult {
  const missingTicketIds = evidence
    .filter((item) => item.relevant !== false && item.rcaStatus !== "approved")
    .map((item) => item.ticketId);
  return missingTicketIds.length > 0
    ? { status: "needs_evidence", mayCalculateFinalAmount: false, missingTicketIds }
    : { status: "ready", mayCalculateFinalAmount: true, missingTicketIds: [] };
}
