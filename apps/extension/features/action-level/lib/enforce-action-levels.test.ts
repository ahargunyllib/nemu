import type { NemuAction, PageElement } from "@nemu/contracts";
import {
  momentOneRequest,
  momentOneResponse,
  momentThreeFollowUpRequest,
  momentTwoResponse,
} from "@nemu/contracts/fixtures";
import { NEMU_IDS } from "@nemu/contracts/nemu-ids";
import { describe, expect, test } from "vite-plus/test";

import { enforceActionLevels } from "./enforce-action-levels";

function click(target: string, label = "Klik"): NemuAction {
  return { type: "click", target, level: "jalan_sendiri", label };
}

function listed(nemuId: string): PageElement {
  return { nemu_id: nemuId, label: nemuId, role: "button", visible: true };
}

describe("enforceActionLevels", () => {
  test("keeps the Momen 1 click on the Jalan sendiri menu from the Element List", () => {
    expect(enforceActionLevels(momentOneResponse.actions, momentOneRequest.elements)).toEqual(
      momentOneResponse.actions,
    );
  });

  test("turns a click on the Konfirmasi Kirim button into a highlight", () => {
    const kirim = click(NEMU_IDS.pertanggungjawaban.kirim, "Kirim");

    expect(enforceActionLevels([kirim], momentThreeFollowUpRequest.elements)).toEqual([
      { type: "highlight", target: kirim.target, level: "arahkan", label: "Kirim" },
    ]);
  });

  test.each([
    ["Dilarang", NEMU_IDS.shell.signOut],
    ["Arahkan", NEMU_IDS.perdinForm.lodgingNotHotel],
    ["unlisted in the config", "tombol-tanpa-level"],
  ])("never clicks a %s element", (_level, target) => {
    const [action] = enforceActionLevels([click(target)], [listed(target)]);

    expect(action?.type).toBe("highlight");
  });

  test("never clicks a Jalan sendiri target missing from the Element List", () => {
    const [action] = enforceActionLevels(momentOneResponse.actions, [
      listed(NEMU_IDS.shell.menuBeranda),
    ]);

    expect(action?.type).toBe("highlight");
  });

  test("passes highlight actions through unchanged", () => {
    expect(enforceActionLevels(momentTwoResponse.actions, [])).toEqual(momentTwoResponse.actions);
  });
});
