import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { call } from "@orpc/server";
import { describe, expect, it } from "vite-plus/test";

import { connectAlurSekolah, createSchoolContext } from "../../testing/school";
import { documentsRouter } from "../documents/router";
import { helpRouter } from "./router";

/**
 * F2-08 through the API: the operator uploads the school's SPP BPMN in WS-04, the symptoms are
 * suggested on upload, and Bu Siti's question is answered from that file, after AlurSekolah says
 * whether the grades are saved. Nothing in the Nemu Service knows about SPP.
 */

const FIXTURES = join(import.meta.dirname, "../../../../ai/src/school/fixtures");
const OPERATOR = { id: "rizal", role: "operator", workspaceId: "W-SEKOLAH" };
const SITI = { id: "siti", role: "guru", workspaceId: "W-SEKOLAH" };
const PAGE = {
  title: "AlurSekolah (tiruan)",
  url: "http://localhost:3003/#/rekap",
  alerts: [],
  headings: ["Rekap Nilai"],
  fields: [],
  screenshotBase64: null,
};

async function withSppProcess() {
  const context = await createSchoolContext(OPERATOR);
  context.alurSekolahFake.siswa.push(
    { nis: "0159870005", nama: "Budi Santoso", kelas: "4B" },
    { nis: "0159870018", nama: "Nabila Putri Ramadhani", kelas: "4B" },
    { nis: "0159870015", nama: "Kevin Ardiansyah", kelas: "4B" },
  );
  for (const [id, nis, nama] of [
    [1, "0159870005", "Budi Santoso"],
    [2, "0159870018", "Nabila Putri Ramadhani"],
  ] as const) {
    context.alurSekolahFake.nilai.push({
      id,
      nis,
      nama_siswa: nama,
      kelas: "4B",
      semester: "Ganjil",
      mapel: "Matematika",
      jenis: "UTS",
      skor: 82,
      tanggal: "2026-11-20",
    });
  }
  const file = new File(
    [await readFile(join(FIXTURES, "F2-1_alur-spp.bpmn"))],
    "F2-1_alur-spp.bpmn",
  );
  const document = await call(
    documentsRouter.uploadDocument,
    { title: "Alur Pembayaran SPP", version: "1", isActive: true, file },
    { context },
  );
  const elements = await call(
    documentsRouter.listProcessElements,
    { id: document.id },
    { context },
  );
  const siti = {
    ...context,
    session: { ...context.session!, user: { ...context.session!.user, ...SITI } },
  };
  return { context, siti, document, elements };
}

/** `F2-1_pertanyaan-dan-kunci.csv` rows: the question and whether AlurSekolah has the grades. */
async function f21Questions() {
  const csv = await readFile(join(FIXTURES, "F2-1_pertanyaan-dan-kunci.csv"), "utf8");
  return csv
    .trim()
    .split("\n")
    .slice(1)
    .map((line) => {
      const [, question, data] = line.match(/^\d+,"([^"]+)",([^,]+),/u) ?? [];
      return { question: question!, saved: data === "tersimpan" };
    });
}

describe("F2-08: nilai tidak muncul, from the uploaded SPP BPMN", () => {
  it("F3-11: upload suggests symptoms the operator can read and correct in WS-04", async () => {
    const { elements } = await withSppProcess();
    expect(elements.find((element) => element.elementId === "Task_KunciNilai")?.symptoms).toEqual([
      "nilai tidak muncul di aplikasi orang tua",
      "rapor anak terlihat kosong di aplikasi orang tua",
    ]);
  });

  it("F2-1: 3/3 questions, grades checked in AlurSekolah first, Bu Ratna, a safe parent reply", async () => {
    const { siti, document } = await withSppProcess();
    await connectAlurSekolah(siti);
    const questions = await f21Questions();
    expect(questions).toHaveLength(3);
    for (const { question, saved } of questions) {
      const answer = await call(
        helpRouter.helpExplain,
        { snapshot: PAGE, question },
        { context: siti },
      );
      expect(answer, question).toMatchObject({
        status: "process",
        certainty: saved ? "confirmed" : "likely",
        process: { documentId: document.id, title: "Alur Pembayaran SPP", version: "1" },
        elementId: "Task_KunciNilai",
        fixer: { name: "Bu Ratna", role: "keuangan" },
      });
      if (answer.status !== "process") continue;
      expect(answer.sentence).toMatch(saved ? /sudah tersimpan\./u : /^Kemungkinan /u);
      expect(answer.steps.length).toBeGreaterThanOrEqual(2);
      expect(answer.steps.length).toBeLessThanOrEqual(4);
      expect(answer.steps.flatMap((step) => step.elementIds)).toContain("Task_BukaKunciNilai");
      expect(answer.parentReply).not.toMatch(/tunggakan|rp\s?\d|\d[\d.]*\s?(ribu|juta)/iu);
    }
    expect(
      siti.alurSekolahFake.requests.some((request) => request.url.pathname === "/api/v1/nilai"),
    ).toBe(true);
  });

  it("F3-13: without AlurSekolah connected, a named student's answer is still only 'kemungkinan'", async () => {
    const { siti } = await withSppProcess();
    const answer = await call(
      helpRouter.helpExplain,
      { snapshot: PAGE, question: "Kenapa nilai Budi tidak muncul di aplikasi orang tua?" },
      { context: siti },
    );
    expect(answer).toMatchObject({ status: "process", certainty: "likely" });
    expect(answer.sentence).toMatch(/^Kemungkinan /u);
  });

  it("F3-13: grades AlurSekolah doesn't have are named, not blamed on the process", async () => {
    const { siti } = await withSppProcess();
    await connectAlurSekolah(siti);
    const answer = await call(
      helpRouter.helpExplain,
      { snapshot: PAGE, question: "Kenapa nilai Kevin tidak muncul di aplikasi orang tua?" },
      { context: siti },
    );
    expect(answer).toEqual({
      status: "grades_not_saved",
      student: "Kevin Ardiansyah",
      sentence:
        "Nilai Kevin Ardiansyah belum tersimpan di AlurSekolah, jadi belum bisa tampil. Simpan dulu nilainya, Ibu.",
    });
  });

  it("F3-12: the operator's corrected symptom is what Nemu matches", async () => {
    const { context, siti, document } = await withSppProcess();
    await call(
      documentsRouter.saveProcessElement,
      {
        id: document.id,
        elementId: "Task_KunciNilai",
        symptoms: ["wali murid tidak bisa melihat hasil ujian anak"],
        page: null,
      },
      { context },
    );
    const answer = await call(
      helpRouter.helpExplain,
      { snapshot: PAGE, question: "Wali murid tidak bisa melihat hasil ujian anak, kenapa?" },
      { context: siti },
    );
    expect(answer).toMatchObject({ status: "process", elementId: "Task_KunciNilai" });
  });

  it("F3-14: something no process covers, with nothing on the page, is 'belum ada di proses sekolah'", async () => {
    const { siti } = await withSppProcess();
    const answer = await call(
      helpRouter.helpExplain,
      { snapshot: PAGE, question: "Kenapa jadwal pelajaran besok berubah?" },
      { context: siti },
    );
    expect(answer).toMatchObject({ status: "not_in_guide" });
    expect(answer.sentence).toMatch(/^Belum ada di proses sekolah\./u);
  });

  it("a bare 'ini kenapa?' on a page without an error stays 'belum ada di panduan sekolah' (F2)", async () => {
    const { siti } = await withSppProcess();
    const answer = await call(
      helpRouter.helpExplain,
      { snapshot: PAGE, question: "Nemu, ini kenapa?" },
      { context: siti },
    );
    expect(answer.sentence).toMatch(/^Belum ada di panduan sekolah\./u);
  });

  it("an error on the page still goes to the Kamus Kendala (F2-2) with the process active", async () => {
    const { siti } = await withSppProcess();
    const answer = await call(
      helpRouter.helpExplain,
      {
        snapshot: {
          ...PAGE,
          alerts: ["Anda belum ditugaskan mengampu IPAS di kelas 4A. Hubungi admin sekolah."],
        },
        question: "Nemu, ini kenapa?",
      },
      { context: siti },
    );
    expect(answer).toMatchObject({ status: "matched", citation: { article: "K-07" } });
  });
});
