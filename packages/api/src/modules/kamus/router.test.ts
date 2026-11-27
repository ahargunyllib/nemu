import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { call } from "@orpc/server";
import { describe, expect, it } from "vite-plus/test";

import { KAMUS_ROWS } from "@nemu/ai/school/fixtures/kamus";

import { createSchoolContext } from "../../testing/school";
import { helpRouter } from "../help/router";
import { kamusRouter } from "./router";
import { parseFixer, parseKamusGrid } from "./service";

/** The official test pack's kamus file, as the school hands it over. */
const OFFICIAL_KAMUS = join(
  import.meta.dirname,
  "../../../../ai/src/school/fixtures/kamus-kendala-sdit-nusantara.json",
);

const fields = (row: Omit<(typeof KAMUS_ROWS)[number], "id">) => ({
  code: row.code,
  app: row.app,
  message: row.message,
  meaning: row.meaning,
  teacherFault: row.teacherFault,
  fixer: row.fixer,
  fix: row.fix,
});

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

  it("W-SEKOLAH holds the official kamus, and importing its JSON file changes nothing", async () => {
    const context = await createSchoolContext();
    const operator = {
      ...context,
      session: { ...context.session!, user: { ...context.session!.user, ...OPERATOR } },
    };
    const seeded = await call(kamusRouter.listKamus, undefined, { context: operator });
    expect(seeded.map((row) => ({ id: row.id, ...fields(row) }))).toEqual(
      KAMUS_ROWS.map((row) => ({ id: row.id, ...fields(row) })),
    );

    const file = new File([await readFile(OFFICIAL_KAMUS)], "kamus-kendala-sdit-nusantara.json");
    await expect(call(kamusRouter.importKamus, { file }, { context: operator })).resolves.toEqual({
      imported: 6,
      skipped: [],
    });
    const imported = await call(kamusRouter.listKamus, undefined, { context: operator });
    expect(imported.map((row) => ({ id: row.id, ...fields(row) }))).toEqual(
      KAMUS_ROWS.map((row) => ({ id: row.id, ...fields(row) })),
    );
  });

  it("reads the role a kamus names first", () => {
    expect(parseFixer("Operator sekolah (bersama kepala sekolah untuk pembagian tugas)")).toBe(
      "operator",
    );
    expect(parseFixer("Operator sekolah (admin AlurSekolah)")).toBe("operator");
    expect(parseFixer("Guru sendiri")).toBe("guru");
    expect(parseFixer("Kepala sekolah")).toBe("kepsek");
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
