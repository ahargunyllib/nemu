import { NEMU_IDS } from "@nemu/contracts/nemu-ids";
import { describe, expect, test } from "vite-plus/test";

import { followsUpAfterClick } from "./follow-up";

describe("followsUpAfterClick", () => {
  test("continues any server guide after its successful navigation click", () => {
    expect(
      followsUpAfterClick(NEMU_IDS.shell.menuAjukanPerjalananDinas, {
        id: "travel-request:create",
        current_step: 1,
        steps: [
          { id: "open", target: NEMU_IDS.shell.menuAjukanPerjalananDinas, label: "Buka" },
          { id: "fill", target: "field-purpose", label: "Isi" },
        ],
      }),
    ).toBe(true);
  });

  test("does not ask again after the final guide action", () => {
    expect(
      followsUpAfterClick(NEMU_IDS.slaClaim.returnToTask, {
        id: "sla-claim:contract",
        current_step: 3,
        steps: [
          { id: "open", target: NEMU_IDS.slaClaim.crmService, label: "Buka CRM" },
          { id: "contract", target: NEMU_IDS.slaClaim.crmContractTab, label: "Buka kontrak" },
          { id: "return", target: NEMU_IDS.slaClaim.returnToTask, label: "Kembali" },
        ],
      }),
    ).toBe(false);
  });

  test("retains the legacy accountability follow-up without a guide", () => {
    expect(followsUpAfterClick(NEMU_IDS.task.pertanggungjawaban)).toBe(true);
    expect(followsUpAfterClick(NEMU_IDS.shell.menuAjukanPerjalananDinas)).toBe(false);
  });
});
