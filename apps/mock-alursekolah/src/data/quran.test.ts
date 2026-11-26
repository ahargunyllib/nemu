import { describe, expect, it } from "vite-plus/test";

import { JUMLAH_AYAT, SURAH, juzAyat, nomorSurah } from "./quran";

describe("Quran reference", () => {
  it("covers 114 surah and 6236 ayat", () => {
    expect(SURAH).toHaveLength(114);
    expect(JUMLAH_AYAT.reduce((a, b) => a + b, 0)).toBe(6236);
  });

  it("places an ayat in its juz at the boundaries", () => {
    expect(juzAyat(2, 141)).toBe(1);
    expect(juzAyat(2, 142)).toBe(2);
    expect(juzAyat(nomorSurah("Al-Mulk") ?? 0, 1)).toBe(29);
    expect(juzAyat(nomorSurah("An-Nas") ?? 0, 6)).toBe(30);
  });
});
