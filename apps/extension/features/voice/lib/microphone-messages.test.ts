import { describe, expect, test } from "vite-plus/test";

import { microphoneBlocked, pointAtAllow } from "./microphone-messages";

describe("microphoneBlocked", () => {
  test("says Nemu can't hear her, then three steps that end with reloading the page", () => {
    expect(microphoneBlocked("Bu")).toEqual({
      status: { text: "Mikrofon terblokir", tone: "muted" },
      title: "Nemu belum bisa mendengar Ibu.",
      detail: "Mikrofon tidak diizinkan. Buka lagi dengan 3 langkah ini:",
      items: [
        "Klik ikon di kiri alamat situs",
        "Pada Mikrofon, pilih Izinkan",
        "Klik Muat ulang di bagian atas",
      ],
    });
  });
});

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
