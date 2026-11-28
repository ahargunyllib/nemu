import { describe, expect, test } from "vite-plus/test";

import { caraLabel, fillSpeedSummary } from "./options";

describe("WS-08 summary on Website diizinkan", () => {
  test("names the default cara the way the teacher hears it", () => {
    expect(caraLabel("isi")).toBe("Cara 1 · Nemu kerjakan, Ibu lihat");
    expect(caraLabel("tunjuk")).toBe("Cara 2 · Nemu tunjuk, Ibu isi");
    expect(caraLabel("cek")).toBe("Cara 3 · Guru isi, Nemu cek");
  });

  test("says cara 1's pace from the executor's interval", () => {
    expect(fillSpeedSummary("pelan")).toBe("±1 kolom per 2 detik");
    expect(fillSpeedSummary("normal")).toBe("±1 kolom per detik");
    expect(fillSpeedSummary("cepat")).toBe("±2 kolom per detik");
  });
});
