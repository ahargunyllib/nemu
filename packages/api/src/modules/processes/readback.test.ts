import { describe, expect, it } from "vite-plus/test";

import { compareSetoran, readbackSetoran } from "./readback";

/** A setoran as AlurSekolah API v1 lists it (`/hafalan/setoran`). */
function saved(name: string, overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    kode: "ST-000001",
    nis: "4105",
    nama_siswa: name,
    kelas: "4A",
    tanggal: "2026-12-01",
    juz: 30,
    ayat: 9,
    surah_nomor: 104,
    surah_nama: "Al-Humazah",
    ayat_awal: 1,
    ayat_akhir: 9,
    penilaian: null,
    penilaian_label: null,
    nilai: 90.2,
    huruf: null,
    keputusan: null,
    keterangan: null,
    label: "Al-Humazah 1-9",
    skor: { fashohah: 92, tartil: 90, tajwid: 87, adab: 95 },
    ...overrides,
  };
}

const CITRA = {
  name: "Citra Lestari",
  values: {
    surah: "Al-Humazah",
    ayat_dari: "1",
    ayat_sampai: "9",
    fashohah: "92",
    tartil: "90",
    tajwid: "87",
    adab: "95",
  },
};

describe("F3·08: the saved setoran read back from AlurSekolah", () => {
  it("a row stored as filled matches, by its range and aspect scores", () => {
    expect(compareSetoran([CITRA], [saved("Citra Lestari")])).toEqual({
      total: 1,
      matched: 1,
      missing: [],
      different: [],
    });
  });

  it("names the cell that differs and the student with no setoran", () => {
    const result = compareSetoran(
      [CITRA, { name: "Bagas Pratama", values: { surah: "Al-Kautsar" } }],
      [saved("Citra Lestari", { skor: { fashohah: 92, tartil: 90, tajwid: 78, adab: 95 } })],
    );
    expect(result).toEqual({
      total: 2,
      matched: 0,
      missing: ["Bagas Pratama"],
      different: ["Citra Lestari: tajwid"],
    });
  });

  it("asks AlurSekolah for that class and date only", async () => {
    const queries: unknown[] = [];
    const result = await readbackSetoran(
      {
        hafalanSetoran: async (query) => {
          queries.push(query);
          return { data: [saved("Citra Lestari")], meta: { total: 1 } } as never;
        },
      },
      { rows: [CITRA], className: "4A", date: "2026-12-01" },
    );
    expect(queries).toEqual([{ kelas: "4A", tanggal: "2026-12-01" }]);
    expect(result.matched).toBe(1);
  });
});
