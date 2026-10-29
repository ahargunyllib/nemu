// @vitest-environment happy-dom
import { NEMU_IDS } from "@nemu/contracts/nemu-ids";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vite-plus/test";

vi.mock("@/shared/api/orpc", () => ({ orpc: {} }));

import { CrmOperationalRecord } from "./operational-record";

afterEach(cleanup);

describe("CrmOperationalRecord", () => {
  test("opens the contract as a real guide step and removes that target after it is complete", () => {
    const { container } = render(
      <CrmOperationalRecord
        customer="PT Nusantara Logistik"
        serviceId="TN-ENT-002"
        contractId="KON-2026-01"
        addendumId="ADD-2026-02"
        effectiveSlaBasisPoints={9_950}
      />,
    );
    const target = `[data-nemu-id="${NEMU_IDS.slaClaim.crmContractTab}"]`;

    expect(container.querySelector(target)).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Buka Kontrak & Adendum" }));

    expect(container.querySelector(target)).toBeNull();
    expect(
      screen.getByText((_, element) =>
        Boolean(
          element?.tagName === "P" &&
          element.textContent?.includes("ADD-2026-02 menetapkan SLA berlaku 99,50%"),
        ),
      ),
    ).toBeDefined();
  });
});
