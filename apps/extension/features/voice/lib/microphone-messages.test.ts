import { describe, expect, test } from "vite-plus/test";

import { pointAtAllow } from "./microphone-messages";

describe("pointAtAllow", () => {
  test("asks her to click Izinkan and names the top one in the detail line", () => {
    expect(pointAtAllow("Bu")).toEqual({
      status: { text: "Giliran Ibu" },
      sentence: "Klik Izinkan, Bu.",
      detail:
        "Pilih Izinkan yang paling atas, supaya Nemu bisa mendengar suara Ibu. Cukup sekali ini saja.",
    });
  });

  test("speaks to a male teacher as Bapak", () => {
    const { status, sentence, detail } = pointAtAllow("Pak");
    expect(status.text).toBe("Giliran Bapak");
    expect(sentence).toBe("Klik Izinkan, Pak.");
    expect(detail).toContain("suara Bapak");
  });
});
