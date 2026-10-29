import assert from "node:assert/strict";
import test from "node:test";

import {
  approvalRoute,
  calculateClaimCutoff,
  calculateSlaCompensation,
  guardRcaEvidence,
  mergeIntervals,
} from "./claim-tools.js";

test("merges overlapping and touching ticket intervals before calculating downtime", () => {
  const merged = mergeIntervals([
    { start: "2026-09-07T08:00:00+07:00", end: "2026-09-07T18:00:00+07:00" },
    { start: "2026-09-07T17:00:00+07:00", end: "2026-09-07T22:00:00+07:00" },
    { start: "2026-09-12T23:00:00+07:00", end: "2026-09-13T02:30:00+07:00" },
  ]);

  assert.deepEqual(
    merged.map((interval) => interval.durationMinutes),
    [14 * 60, 3.5 * 60],
  );
  assert.equal(
    merged.reduce((total, interval) => total + interval.durationMinutes, 0),
    17.5 * 60,
  );
});

test("keeps genuinely separate intervals separate", () => {
  assert.equal(
    mergeIntervals([
      { start: "2026-09-07T08:00:00Z", end: "2026-09-07T09:00:00Z" },
      { start: "2026-09-07T09:01:00Z", end: "2026-09-07T10:00:00Z" },
    ]).length,
    2,
  );
});

test("calculates KLM-2610-0007 with exact rational arithmetic", () => {
  assert.deepEqual(
    calculateSlaCompensation({
      totalPeriodMinutes: 720 * 60,
      slaBasisPoints: 9_950,
      actualDowntimeMinutes: 17.5 * 60,
      monthlyFee: 30_000_000,
    }),
    {
      totalPeriodMinutes: 43_200,
      allowedDowntimeMinutes: 216,
      actualDowntimeMinutes: 1_050,
      excessDowntimeMinutes: 834,
      amount: 579_167,
      capped: false,
    },
  );
});

test("rounds half up to rupiah and caps compensation at the monthly fee", () => {
  assert.equal(
    calculateSlaCompensation({
      totalPeriodMinutes: 2,
      slaBasisPoints: 10_000,
      actualDowntimeMinutes: 1,
      monthlyFee: 1,
    }).amount,
    1,
  );
  assert.deepEqual(
    calculateSlaCompensation({
      totalPeriodMinutes: 100,
      slaBasisPoints: 10_000,
      actualDowntimeMinutes: 200,
      monthlyFee: 1_000_000,
    }),
    {
      totalPeriodMinutes: 100,
      allowedDowntimeMinutes: 0,
      actualDowntimeMinutes: 200,
      excessDowntimeMinutes: 200,
      amount: 1_000_000,
      capped: true,
    },
  );
});

test("uses the billing email stamp against the 15th of the following month", () => {
  assert.deepEqual(calculateClaimCutoff("2026-09", "2026-10-08T16:20:00+07:00"), {
    period: "2026-09",
    receivedDate: "2026-10-08",
    deadline: "2026-10-15",
    timely: true,
  });
  assert.equal(calculateClaimCutoff("2026-08", "2026-09-16T00:01:00+07:00").timely, false);
});

test("selects every approver required by the matching amount band", () => {
  const rules = [
    { minimumAmount: 0, approvers: ["Sari Wulandari"] },
    { minimumAmount: 500_001, approvers: ["Sari Wulandari", "Hendra Gunawan"] },
  ];

  assert.deepEqual(approvalRoute(579_167, rules), ["Sari Wulandari", "Hendra Gunawan"]);
  assert.deepEqual(approvalRoute(500_000, rules), ["Sari Wulandari"]);
});

test("suppresses a final amount while a relevant ticket has no approved RCA", () => {
  assert.deepEqual(
    guardRcaEvidence([
      { ticketId: "INC-2609-014", rcaStatus: "approved" },
      { ticketId: "INC-2609-058", rcaStatus: "missing" },
    ]),
    {
      status: "needs_evidence",
      mayCalculateFinalAmount: false,
      missingTicketIds: ["INC-2609-058"],
    },
  );
  assert.equal(
    guardRcaEvidence([{ ticketId: "INC-2609-014", rcaStatus: "approved" }]).mayCalculateFinalAmount,
    true,
  );
});
