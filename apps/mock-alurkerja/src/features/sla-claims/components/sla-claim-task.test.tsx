// @vitest-environment happy-dom
import { NEMU_IDS } from "@nemu/contracts/nemu-ids";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vite-plus/test";

import SlaClaimTask, { type SlaClaimDetail } from "./sla-claim-task";

function detail(
  name: string,
  options: { timely?: boolean; missingTicketIds?: string[] } = {},
): SlaClaimDetail {
  return {
    claim: {
      id: "KLM-2610-0007",
      customer: "PT Arunika Retail",
      letterNumber: "ARN/IT/118/X/2026",
      serviceId: "TN-ENT-002",
      period: options.timely === false ? "2026-08" : "2026-09",
      receivedAt: "2026-10-08T14:12:00+07:00",
      claimedMinutes: 1530,
      invoiceId: "INV-2609-0042",
    },
    context: {
      service: {
        contractId: "KON-2026-01",
        addendumId: "ADD-2026-02",
        effectiveSlaBasisPoints: 9950,
      },
      invoice: { monthlyFeeIdr: 30_000_000 },
      tickets: [
        {
          id: options.missingTicketIds?.[0] ?? "INC-2609-014",
          start: "2026-09-03T08:00:00+07:00",
          end: "2026-09-03T20:00:00+07:00",
          cause: "PENYEDIA",
          rcaId: options.missingTicketIds?.length ? null : "RCA-2609-07",
          rcaStatus: options.missingTicketIds?.length ? "MENUNGGU" : "DISAHKAN",
        },
      ],
    },
    task: {
      id: "T-0007-1",
      name,
      status: options.missingTicketIds?.length ? "PERLU_BUKTI" : "OPEN",
      reviewDueOn: "2026-10-15",
    },
    summary: {
      cutoff: {
        period: options.timely === false ? "2026-08" : "2026-09",
        receivedDate: "2026-10-08",
        deadline: options.timely === false ? "2026-09-15" : "2026-10-15",
        timely: options.timely ?? true,
      },
      totalPeriodMinutes: 43_200,
      allowedDowntimeMinutes: 216,
      actualDowntimeMinutes: 1050,
      compensationAmount: options.missingTicketIds?.length ? null : 579_167,
      missingTicketIds: options.missingTicketIds ?? [],
      excludedTicketIds: ["INC-2609-031"],
      approvers: ["Sari Wulandari (Supervisor Billing)"],
    },
  };
}

afterEach(cleanup);

describe("SlaClaimTask", () => {
  test("renders every stable registration placeholder with the stored claim values", () => {
    const { container } = render(<SlaClaimTask detail={detail("Registrasi Klaim")} />);

    for (const id of [
      NEMU_IDS.slaClaim.letterNumber,
      NEMU_IDS.slaClaim.serviceId,
      NEMU_IDS.slaClaim.period,
      NEMU_IDS.slaClaim.receivedAt,
      NEMU_IDS.slaClaim.claimedHours,
      NEMU_IDS.slaClaim.uploadLetter,
      NEMU_IDS.slaClaim.timelyYes,
      NEMU_IDS.slaClaim.timelyNo,
      NEMU_IDS.slaClaim.submit,
    ]) {
      expect(container.querySelector(`[data-nemu-id="${id}"]`)).not.toBeNull();
    }
    expect(screen.getByDisplayValue("25.5")).toBeTruthy();
  });

  test("renders the missing-RCA branch without a final compensation amount", () => {
    const { container } = render(
      <SlaClaimTask
        detail={detail("Telaah Tiket Gangguan", { missingTicketIds: ["INC-2609-058"] })}
      />,
    );

    expect(
      container.querySelector(`[data-nemu-id="${NEMU_IDS.slaClaim.ticketInc2609058}"]`),
    ).not.toBeNull();
    expect(
      container.querySelector(`[data-nemu-id="${NEMU_IDS.slaClaim.requestRcaInc2609058}"]`),
    ).not.toBeNull();
    expect(screen.getByText(/Nominal belum dapat ditetapkan/)).toBeTruthy();
  });

  test("renders the late-claim rejection branch and template link", () => {
    const { container } = render(
      <SlaClaimTask detail={detail("Surat Penolakan", { timely: false })} />,
    );

    expect(
      container.querySelector(`[data-nemu-id="${NEMU_IDS.slaClaim.rejectionTemplate}"]`),
    ).not.toBeNull();
    expect(screen.getByText(/melewati batas 15 September 2026/)).toBeTruthy();
  });

  test("keeps approval visible but disabled for the Billing Liaison", () => {
    const { container } = render(<SlaClaimTask detail={detail("Persetujuan")} />);
    const approve = container.querySelector(`[data-nemu-id="${NEMU_IDS.slaClaim.approve}"]`);
    const compensation = container.querySelector<HTMLInputElement>(
      `[data-nemu-id="${NEMU_IDS.slaClaim.compensationAmount}"]`,
    );

    expect(approve).toHaveProperty("disabled", true);
    expect(compensation).toHaveProperty("readOnly", false);
    expect(compensation).toHaveProperty("value", "");
  });
});
