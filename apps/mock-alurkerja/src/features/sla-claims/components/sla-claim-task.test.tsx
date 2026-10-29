// @vitest-environment happy-dom
import { NEMU_IDS } from "@nemu/contracts/nemu-ids";
import { Sheet, SheetContent } from "@nemu/ui/components/sheet";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, describe, expect, test, vi } from "vite-plus/test";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, params: _params, ...props }: { to: string; params?: object }) => (
    <a href={to} {...props} />
  ),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));

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

/** The task renders inside its sheet, which portals to the body. */
function renderTask(task: ReactElement) {
  render(
    <Sheet open modal={false}>
      <SheetContent showCloseButton={false}>{task}</SheetContent>
    </Sheet>,
  );
  return { container: document.body };
}

afterEach(cleanup);

describe("SlaClaimTask", () => {
  test("renders every stable registration placeholder with the stored claim values", () => {
    const { container } = renderTask(
      <SlaClaimTask assignee="Dimas Pratama" detail={detail("Registrasi Klaim")} />,
    );

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
    const { container } = renderTask(
      <SlaClaimTask
        assignee="Dimas Pratama"
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

  test("asks NOC for the missing RCA once", () => {
    const { container } = renderTask(
      <SlaClaimTask
        assignee="Dimas Pratama"
        detail={detail("Telaah Tiket Gangguan", { missingTicketIds: ["INC-2609-058"] })}
      />,
    );
    const request = container.querySelector<HTMLButtonElement>(
      `[data-nemu-id="${NEMU_IDS.slaClaim.requestRcaInc2609058}"]`,
    );

    fireEvent.click(screen.getByRole("button", { name: "Minta RCA" }));

    expect(request?.textContent).toBe("RCA diminta");
    expect(request).toHaveProperty("disabled", true);
  });

  test("drafts the late-claim rejection letter from TPL-BILL-02", () => {
    const { container } = renderTask(
      <SlaClaimTask
        assignee="Dimas Pratama"
        detail={detail("Surat Penolakan", { timely: false })}
      />,
    );
    const letter = container.querySelector<HTMLTextAreaElement>(
      `[data-nemu-id="${NEMU_IDS.slaClaim.rejectionTemplate}"]`,
    );

    expect(screen.getByText(/melewati batas 15 September 2026/)).toBeTruthy();
    expect(letter?.value).toContain("Nomor: TOL-SLA/KLM-2610-0007");
    expect(letter?.value).toContain(
      "surat klaim nomor ARN/IT/118/X/2026 untuk layanan TN-ENT-002 periode Agustus 2026",
    );
  });

  test("keeps approval visible but disabled for the Billing Liaison", () => {
    const { container } = renderTask(
      <SlaClaimTask assignee="Dimas Pratama" detail={detail("Persetujuan")} />,
    );
    const approve = container.querySelector(`[data-nemu-id="${NEMU_IDS.slaClaim.approve}"]`);
    const compensation = container.querySelector<HTMLInputElement>(
      `[data-nemu-id="${NEMU_IDS.slaClaim.compensationAmount}"]`,
    );

    expect(approve).toHaveProperty("disabled", true);
    expect(compensation).toHaveProperty("readOnly", false);
    expect(compensation).toHaveProperty("value", "");
  });

  test("leaves the compensation amount to Nemu instead of printing it in the task", () => {
    renderTask(<SlaClaimTask assignee="Dimas Pratama" detail={detail("Susun Berita Acara")} />);

    expect(screen.queryByText(/579\.167/)).toBeNull();
  });

  test("heads the sheet with the stage, the claim's dates, and the assignee", () => {
    renderTask(<SlaClaimTask assignee="Dimas Pratama" detail={detail("Registrasi Klaim")} />);

    expect(screen.getByRole("heading", { name: "Registrasi Klaim #KLM-2610-0007" })).toBeTruthy();
    expect(screen.getByText("Klaim Kompensasi SLA · Tahap 1 dari 6")).toBeTruthy();
    expect(screen.getByText("8 Okt 2026")).toBeTruthy();
    expect(screen.getByText("15 Okt 2026")).toBeTruthy();
    expect(screen.getByText("Dimas Pratama")).toBeTruthy();
  });

  test("shows a spinner on Complete Task while the Task advances", () => {
    const { container } = renderTask(
      <SlaClaimTask assignee="Dimas Pratama" detail={detail("Registrasi Klaim")} advancing />,
    );
    const submit = container.querySelector(`[data-nemu-id="${NEMU_IDS.slaClaim.submit}"]`);

    expect(submit).toHaveProperty("disabled", true);
    expect(submit?.textContent).toBe("Complete Task");
    expect(submit?.querySelector('[role="status"]')).not.toBeNull();
  });
});
