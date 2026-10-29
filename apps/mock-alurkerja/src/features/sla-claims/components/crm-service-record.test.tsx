// @vitest-environment happy-dom
import { NEMU_IDS } from "@nemu/contracts/nemu-ids";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vite-plus/test";

import CrmServiceRecord from "./crm-service-record";

afterEach(cleanup);

function renderRecord(addendumId: string | null) {
  return render(
    <CrmServiceRecord
      customer="PT Arunika Retail"
      serviceId={addendumId ? "TN-ENT-002" : "TN-ENT-001"}
      contractId="KON-2026-01"
      addendumId={addendumId}
      effectiveSlaBasisPoints={addendumId ? 9_950 : 9_900}
      monthlyFeeIdr={30_000_000}
    />,
  );
}

describe("CrmServiceRecord", () => {
  test("opens Kontrak & Adendum as a guide step and drops that target once it is open", () => {
    const { container } = renderRecord("ADD-2026-02");
    const target = `[data-nemu-id="${NEMU_IDS.slaClaim.crmContractTab}"]`;

    expect(container.querySelector(target)).not.toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: "Kontrak & Adendum" }));

    expect(container.querySelector(target)).toBeNull();
    expect(screen.getByText("Adendum ADD-2026-02")).toBeTruthy();
    expect(screen.getByText("SLA baru").nextElementSibling?.textContent).toBe("99,50%");
  });

  test("lists the draft ADD-2026-03 under Adendum lain as not in force", () => {
    renderRecord("ADD-2026-02");
    fireEvent.click(screen.getByRole("tab", { name: "Kontrak & Adendum" }));

    expect(screen.getByText(/^ADD-2026-03/).textContent).toBe(
      "ADD-2026-03 (rancangan, belum disahkan · ubah jam pemeliharaan · tidak berlaku)",
    );
  });

  test("strikes the contract's SLA only when a signed addendum replaces it", () => {
    const { container } = renderRecord("ADD-2026-02");
    fireEvent.click(screen.getByRole("tab", { name: "Kontrak & Adendum" }));
    expect(container.querySelector("s")?.textContent).toBe("99,00%");

    cleanup();
    const plain = renderRecord(null);
    fireEvent.click(screen.getByRole("tab", { name: "Kontrak & Adendum" }));
    expect(plain.container.querySelector("s")).toBeNull();
    expect(screen.queryByText(/^Adendum ADD-/)).toBeNull();
  });
});
