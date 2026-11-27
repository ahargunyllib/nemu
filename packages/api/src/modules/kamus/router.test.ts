import { call } from "@orpc/server";
import { describe, expect, it } from "vite-plus/test";

import { createSchoolContext } from "../../testing/school";
import { helpRouter } from "../help/router";
import { kamusRouter } from "./router";
import { parseKamusGrid } from "./service";

const OPERATOR = { id: "rizal", role: "operator", workspaceId: "W-SEKOLAH" };

const RAPOR_SNAPSHOT = {
  title: "AlurSekolah - Rapor",
  url: "https://sditn.alursekolah.id/rapor",
  alerts: ["Rapor belum bisa dicetak karena nilai sikap belum diisi wali kelas."],
  headings: [],
  fields: [],
  screenshotBase64: null,
};

describe("WS-05 Kamus Kendala", () => {
  it("answers 'ini kenapa?' from a row the operator just typed", async () => {
    const context = await createSchoolContext();
    const operator = {
      ...context,
      session: { ...context.session!, user: { ...context.session!.user, ...OPERATOR } },
    };
    await expect(
      call(helpRouter.helpExplain, { snapshot: RAPOR_SNAPSHOT, question: null }, { context }),
    ).resolves.toMatchObject({ status: "not_in_guide" });

    await call(
      kamusRouter.createKamus,
      {
        code: "K-10",
        app: "AlurSekolah",
        message: "Rapor belum bisa dicetak karena nilai sikap belum diisi wali kelas",
        meaning: "Nilai sikap diisi wali kelas sebelum rapor dicetak",
        teacherFault: false,
        fixer: "operator",
        fix: "Operator sekolah perlu membuka pengisian nilai sikap untuk wali kelas",
      },
      { context: operator },
    );
    const rows = await call(kamusRouter.listKamus, undefined, { context: operator });
    expect(rows.map((row) => row.code)).toEqual([
      "K-01",
      "K-02",
      "K-03",
      "K-04",
      "K-05",
      "K-06",
      "K-07",
      "K-10",
    ]);

    await expect(
      call(helpRouter.helpExplain, { snapshot: RAPOR_SNAPSHOT, question: null }, { context }),
    ).resolves.toMatchObject({
      status: "matched",
      citation: { docId: "kamus-kendala", article: "K-10" },
    });
  });

  it("keeps the kamus from a teacher", async () => {
    const context = await createSchoolContext();
    await expect(call(kamusRouter.listKamus, undefined, { context })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("reads an Excel sheet with its own headers and skips rows it can't use", () => {
    const result = parseKamusGrid([
      ["Kamus Kendala SDIT Nusantara"],
      [
        "Kode",
        "Aplikasi",
        "Pesan error",
        "Arti",
        "Kesalahan guru?",
        "Yang memperbaiki",
        "Yang dilakukan",
      ],
      [
        "K-20",
        "e-Rapor",
        "Sinkronisasi gagal",
        "",
        "Tidak",
        "Kepala Sekolah",
        "Kepala sekolah perlu menyetujui.",
      ],
      ["", "AlurSekolah", "Token kedaluwarsa", "", "Ya", "Guru", "Guru cukup masuk kembali."],
      ["K-22", "AlurSekolah", "Kelas kosong", "", "", "satpam", "Hubungi satpam."],
      ["", "", "", "", "", "", ""],
    ]);
    expect(result.entries).toEqual([
      {
        code: "K-20",
        app: "e-Rapor",
        message: "Sinkronisasi gagal",
        meaning: "",
        teacherFault: false,
        fixer: "kepsek",
        fix: "Kepala sekolah perlu menyetujui.",
      },
      expect.objectContaining({ code: "K-02", teacherFault: true, fixer: "guru" }),
    ]);
    expect(result.skipped).toEqual([{ row: 5, reason: "Yang memperbaiki tidak dikenali" }]);
  });
});
