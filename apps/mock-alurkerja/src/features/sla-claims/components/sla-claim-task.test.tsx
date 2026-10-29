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
  options: { timely?: boolean; missingTicketIds?: string[]; canApprove?: boolean } = {},
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
    assignee: "Dimas Pratama",
    canAdvance: name !== "Persetujuan" && !options.canApprove,
    canApprove: options.canApprove ?? false,
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
      approvers: [
        "Sari Wulandari (Supervisor Billing)",
        "Hendra Gunawan (Manajer Billing Operations)",
      ],
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
    expect(screen.getByDisplayValue("25,5 jam (sesuai surat)")).toBeTruthy();
    expect(screen.getByDisplayValue("September 2026")).toBeTruthy();
  });

  test("leaves Tanggal klaim diterima empty for Nemu's Isi and the timely question unanswered", () => {
    const { container } = renderTask(
      <SlaClaimTask assignee="Dimas Pratama" detail={detail("Registrasi Klaim")} />,
    );
    const received = container.querySelector<HTMLInputElement>(
      `[data-nemu-id="${NEMU_IDS.slaClaim.receivedAt}"]`,
    );

    expect(received?.value).toBe("");
    expect(received?.placeholder).toBe("dd/mm/yyyy");
    expect(received).toHaveProperty("readOnly", false);
    for (const radio of screen.getAllByRole("radio")) {
      expect(radio.getAttribute("aria-checked")).toBe("false");
    }
  });

  test("counts A only from the tickets marked Dihitung once the intervals are merged", () => {
    const tickets = [
      ["INC-2609-014", "2026-09-03T08:00:00+07:00", "2026-09-03T20:00:00+07:00", "PENYEDIA"],
      ["INC-2609-015", "2026-09-03T18:00:00+07:00", "2026-09-03T22:00:00+07:00", "PENYEDIA"],
      ["INC-2609-031", "2026-09-10T00:00:00+07:00", "2026-09-10T06:00:00+07:00", "DAYA_PELANGGAN"],
      ["INC-2609-047", "2026-09-21T13:00:00+07:00", "2026-09-21T16:30:00+07:00", "PENYEDIA"],
    ].map(([id = "", start = "", end = "", cause = ""]) => ({
      id,
      start,
      end,
      cause,
      rcaId: "RCA-2609-07",
      rcaStatus: "DISAHKAN",
    }));
    const base = detail("Telaah Tiket Gangguan");
    const { container } = renderTask(
      <SlaClaimTask
        assignee="Dimas Pratama"
        detail={{ ...base, context: { ...base.context, tickets } }}
      />,
    );
    const decide = (ticketId: string, decision: string) => {
      const control = container.querySelector(`[data-nemu-id="seg-keputusan-${ticketId}"]`);
      const option = [...(control?.querySelectorAll("button") ?? [])].find(
        (button) => button.textContent === decision,
      );
      if (!option) throw new Error(`no ${decision} for ${ticketId}`);
      fireEvent.click(option);
    };

    expect(screen.getByText("08.00–20.00").previousElementSibling?.textContent).toBe("3 Sep");
    for (const id of ["INC-2609-014", "INC-2609-015", "INC-2609-047"]) decide(id, "Dihitung");
    decide("INC-2609-031", "Dikecualikan");
    fireEvent.click(screen.getByRole("button", { name: "Gabungkan interval" }));

    expect(screen.getByText("Durasi dihitung (A)").nextElementSibling?.textContent).toBe(
      "17,5 jam",
    );
    expect(screen.getByText("Diklaim pelanggan").nextElementSibling?.textContent).toBe("25,5 jam");
  });

  test("renders ticket and decision targets for a ticket outside the seeded id list", () => {
    const base = detail("Telaah Tiket Gangguan");
    const { container } = renderTask(
      <SlaClaimTask
        assignee="Dimas Pratama"
        detail={{
          ...base,
          context: {
            ...base.context,
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
          },
        }}
      />,
    );

    expect(container.querySelector('[data-nemu-id="row-tiket-inc-2609-022"]')).not.toBeNull();
    expect(container.querySelector('[data-nemu-id="seg-keputusan-INC-2609-022"]')).not.toBeNull();
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

  test("asks NOC once for a missing RCA outside the seeded ticket list", () => {
    const { container } = renderTask(
      <SlaClaimTask
        assignee="Dimas Pratama"
        detail={detail("Telaah Tiket Gangguan", { missingTicketIds: ["INC-2609-099"] })}
      />,
    );
    const request = container.querySelector<HTMLButtonElement>(
      '[data-nemu-id="button-minta-rca-inc-2609-099"]',
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

  test("lets the approver whose turn it is approve the claim", () => {
    const onAdvance = vi.fn();
    const { container } = renderTask(
      <SlaClaimTask
        assignee="Dimas Pratama"
        detail={detail("Persetujuan", { canApprove: true })}
        onAdvance={onAdvance}
      />,
    );
    const approve = container.querySelector(`[data-nemu-id="${NEMU_IDS.slaClaim.approve}"]`);

    expect(approve).toHaveProperty("disabled", false);
    fireEvent.click(screen.getByRole("button", { name: "Setujui klaim" }));
    expect(onAdvance).toHaveBeenCalledOnce();
  });

  test("keeps Selesaikan Tugas disabled for an approver viewing the Credit Note", () => {
    const { container } = renderTask(
      <SlaClaimTask
        assignee="Dimas Pratama"
        detail={{ ...detail("Credit Note"), canAdvance: false }}
      />,
    );

    expect(container.querySelector(`[data-nemu-id="${NEMU_IDS.slaClaim.submit}"]`)).toHaveProperty(
      "disabled",
      true,
    );
  });

  test("ends at the Credit Note with the approved amount and route", () => {
    renderTask(<SlaClaimTask assignee="Dimas Pratama" detail={detail("Credit Note")} />);

    expect(screen.getByText("Klaim Kompensasi SLA · Tahap 6 dari 6")).toBeTruthy();
    expect(screen.getByText("Rp579.167")).toBeTruthy();
    expect(
      screen.getByText(
        "Sari Wulandari (Supervisor Billing), Hendra Gunawan (Manajer Billing Operations)",
      ),
    ).toBeTruthy();
  });

  test("leaves the compensation amount to Nemu instead of printing it in the task", () => {
    renderTask(<SlaClaimTask assignee="Dimas Pratama" detail={detail("Susun Berita Acara")} />);

    expect(screen.queryByText(/579\.167/)).toBeNull();
  });

  test("fills in the computed terms on Hitung and drafts the berita acara from the amount", () => {
    renderTask(<SlaClaimTask assignee="Dimas Pratama" detail={detail("Susun Berita Acara")} />);
    const draft = screen.getByRole("button", { name: "Buat draft berita acara" });

    expect(screen.getByText("A · dihitung").nextElementSibling?.textContent).toBe("–");
    fireEvent.click(screen.getByRole("button", { name: "Hitung" }));
    expect(screen.getByText("A · dihitung").nextElementSibling?.textContent).toBe("17,5 jam");

    expect(screen.getByText("Sari Wulandari")).toBeTruthy();
    expect(screen.getByText("Manajer Billing Operations")).toBeTruthy();
    expect(screen.getByText("Di atas Rp500.000")).toBeTruthy();

    expect(draft).toHaveProperty("disabled", true);
    fireEvent.change(screen.getByLabelText("Nominal usulan"), { target: { value: "579167" } });
    fireEvent.click(draft);
    expect(screen.getByLabelText<HTMLTextAreaElement>("Draft berita acara").value).toContain(
      "6. Nominal usulan: Rp579.167.",
    );
  });

  test("heads the sheet with the stage, the claim's dates, and the assignee", () => {
    renderTask(<SlaClaimTask assignee="Dimas Pratama" detail={detail("Registrasi Klaim")} />);

    expect(screen.getByRole("heading", { name: "Registrasi Klaim #KLM-2610-0007" })).toBeTruthy();
    expect(screen.getByText("Klaim Kompensasi SLA · Tahap 1 dari 6")).toBeTruthy();
    expect(screen.getByText("8 Okt 2026")).toBeTruthy();
    expect(screen.getByText("15 Okt 2026")).toBeTruthy();
    expect(screen.getByText("Dimas Pratama")).toBeTruthy();
  });

  test("shows a spinner on Selesaikan Tugas while the Task advances", () => {
    const { container } = renderTask(
      <SlaClaimTask assignee="Dimas Pratama" detail={detail("Registrasi Klaim")} advancing />,
    );
    const submit = container.querySelector(`[data-nemu-id="${NEMU_IDS.slaClaim.submit}"]`);

    expect(submit).toHaveProperty("disabled", true);
    expect(submit?.textContent).toBe("Selesaikan Tugas");
    expect(submit?.querySelector('[role="status"]')).not.toBeNull();
  });
});
