import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { call } from "@orpc/server";
import { describe, expect, it, vi } from "vite-plus/test";

import { connectAlurSekolah, createSchoolContext } from "../../testing/school";
import { documentsRouter } from "../documents/router";
import { createRegistrySchoolDirectory } from "../school/registry-directory";
import { createSchoolRepository } from "../school/repository";
import { helpRouter } from "./router";

/**
 * F2-08 through the API, on the official F2-1 files: the operator uploads the school's SPP BPMN in
 * WS-04, the symptom index is suggested on upload, and Bu Siti's three questions are answered from
 * that file, after AlurSekolah says whether Aisyah's grades are saved. Nothing in the Nemu Service
 * knows about SPP.
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
    { nis: "4101", nama: "Aisyah Putri Wijaya", kelas: "4A" },
    { nis: "0159870015", nama: "Kevin Ardiansyah", kelas: "4B" },
  );
  context.alurSekolahFake.nilai.push({
    id: 1,
    nis: "4101",
    nama_siswa: "Aisyah Putri Wijaya",
    kelas: "4A",
    semester: "Ganjil",
    mapel: "Bahasa Inggris",
    jenis: "UTS",
    skor: 86,
    tanggal: "2026-11-20",
  });
  const file = new File(
    [await readFile(join(FIXTURES, "F2-1_alur-spp.bpmn"))],
    "F2-1_alur-spp.bpmn",
  );
  const document = await call(
    documentsRouter.uploadDocument,
    { title: "Alur SPP", version: "1", isActive: true, file },
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

/** `F2-1_pertanyaan-dan-kunci.csv`: the official questions, the second cell of each row. */
async function f21Questions() {
  const csv = await readFile(join(FIXTURES, "F2-1_pertanyaan-dan-kunci.csv"), "utf8");
  return csv
    .trim()
    .split("\n")
    .slice(1)
    .map((line) => line.match(/^\d+,("[^"]+"|[^,]+),/u)![1]!.replace(/^"|"$/gu, ""));
}

/** What each question must find and cite (the CSV's `elemen_bpmn_sumber` and `lulus_jika`). */
const EXPECTED = [
  {
    elementId: "Task_LockGrades",
    saved: true,
    cites: ["Timer_DueDateReached", "Gw_IsRegularInvoice", "Task_LockGrades", "Task_UnlockGrades"],
  },
  {
    elementId: "Task_UpdatePartiallyPaid",
    saved: false,
    cites: ["Task_CheckInvoices", "Flow_10", "Task_UpdatePartiallyPaid", "Task_UnlockGrades"],
  },
  {
    elementId: "Task_UnlockGrades",
    saved: false,
    cites: ["Boundary_PaidInCash", "Task_CheckInvoices", "Flow_12", "Task_UnlockGrades"],
  },
] as const;

describe("F2-08: nilai tidak muncul, from the uploaded SPP BPMN", () => {
  it("F3-11: upload indexes symptoms, way back and role the operator can read and correct", async () => {
    const { elements } = await withSppProcess();
    expect(elements.find((element) => element.elementId === "Task_LockGrades")).toMatchObject({
      kind: "task",
      symptoms: [
        "nilai tidak muncul di aplikasi orang tua",
        "nilai murid terkunci setelah jatuh tempo",
      ],
      wayBack: "Task_UnlockGrades",
      role: "bagian keuangan",
    });
    expect(elements.find((element) => element.elementId === "Boundary_PaidInCash")).toMatchObject({
      kind: "event",
      symptoms: ["orang tua bayar tunai di sekolah"],
    });
  });

  it("F2-1: 3/3 official questions, Aisyah's grade checked in AlurSekolah, Bu Ratna, a safe reply", async () => {
    const { siti, document } = await withSppProcess();
    await connectAlurSekolah(siti);
    const questions = await f21Questions();
    expect(questions).toHaveLength(3);
    for (const [index, question] of questions.entries()) {
      const expected = EXPECTED[index]!;
      const answer = await call(
        helpRouter.helpExplain,
        { snapshot: PAGE, question },
        { context: siti },
      );
      expect(answer, question).toMatchObject({
        status: "process",
        process: { documentId: document.id, title: "Alur SPP", version: "1" },
        elementId: expected.elementId,
        fixer: { name: "Bu Ratna", role: "keuangan" },
      });
      if (answer.status !== "process") continue;
      if (expected.saved)
        expect(answer.sentence).toMatch(
          /^Nilai Aisyah Putri Wijaya sudah tersimpan\. Bukan kesalahan Ibu\. Kemungkinan karena alur SPP sekolah: /u,
        );
      expect(answer.steps.length).toBeGreaterThanOrEqual(2);
      expect(answer.steps.length).toBeLessThanOrEqual(4);
      expect(answer.steps.flatMap((step) => step.elementIds)).toEqual(
        expect.arrayContaining([...expected.cites]),
      );
      expect(answer.parentReply).toMatch(/Bu Ratna/u);
      expect(answer.parentReply).not.toMatch(/tunggak|nunggak|rp\s?\d|\d[\d.]*\s?(ribu|juta)/iu);
    }
    expect(
      siti.alurSekolahFake.requests.some(
        (request) =>
          request.url.pathname === "/api/v1/nilai" &&
          request.url.searchParams.get("nis") === "4101",
      ),
    ).toBe(true);
  });

  it("F3-12: the role the operator corrects in WS-04 decides who helps", async () => {
    const { context, siti, document, elements } = await withSppProcess();
    for (const element of elements) {
      await call(
        documentsRouter.saveProcessElement,
        {
          id: document.id,
          elementId: element.elementId,
          symptoms: element.symptoms,
          page: element.page,
          role: "operator sekolah",
        },
        { context },
      );
    }
    const answer = await call(
      helpRouter.helpExplain,
      { snapshot: PAGE, question: "Nilai UTS Aisyah kok tidak muncul di aplikasi orang tua?" },
      { context: siti },
    );
    expect(answer).toMatchObject({ status: "process", fixer: { name: "Pak Rizal" } });
  });

  it("F3-13: without AlurSekolah connected, a named student's answer is still only 'kemungkinan'", async () => {
    const { siti } = await withSppProcess();
    const answer = await call(
      helpRouter.helpExplain,
      { snapshot: PAGE, question: "Nilai UTS Aisyah kok tidak muncul di aplikasi orang tua?" },
      { context: siti },
    );
    expect(answer).toMatchObject({ status: "process" });
    expect(answer.sentence).toMatch(/^Kemungkinan karena alur SPP sekolah: /u);
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
        elementId: "Task_LockGrades",
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
    expect(answer).toMatchObject({
      status: "process",
      elementId: "Task_LockGrades",
      fixer: { name: "Bu Ratna" },
    });
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

/**
 * The stack `verify:f2-08` runs: Bu Siti from the seeded WS-06 registry (wali kelas 4A, teaches
 * 4A and 4B) and an AlurSekolah shaped like the mock, which has two pupils called Aisyah.
 */
describe("F2-08 with the seeded WS-06 teacher and the mock's pupils", () => {
  async function seededStack() {
    const { siti } = await withSppProcess();
    const directory = createRegistrySchoolDirectory(createSchoolRepository(siti.db));
    const teacher = { ...siti, school: { ...siti.school, directory } };
    teacher.alurSekolahFake.siswa.splice(
      0,
      teacher.alurSekolahFake.siswa.length,
      { nis: "4101", nama: "Aisyah Putri Wijaya", kelas: "4A", wali_kelas: "Siti Aminah, S.Pd." },
      { nis: "0159870002", nama: "Aisyah Zahra", kelas: "4B", wali_kelas: "" },
    );
    await connectAlurSekolah(teacher);
    return teacher;
  }

  it("Q1: 'Aisyah' is the pupil in the asking teacher's own homeroom, so her saved grade counts", async () => {
    const siti = await seededStack();
    const answer = await call(
      helpRouter.helpExplain,
      { snapshot: PAGE, question: "Nilai UTS Aisyah kok tidak muncul di aplikasi orang tua?" },
      { context: siti },
    );
    expect(answer).toMatchObject({ status: "process" });
    expect(answer.sentence).toMatch(/^Nilai Aisyah Putri Wijaya sudah tersimpan\./u);
  });

  it("Q3: a process question without 'kenapa' is routed to the process, not the SOP", async () => {
    const siti = await seededStack();
    const route = await call(
      helpRouter.helpRoute,
      { utterance: "Kalau bayar tunai, kapan nilainya terbuka?" },
      { context: siti },
    );
    expect(route).toEqual({ kind: "intent", intent: "kenapa", processName: null });
  });

  it("an SOP question still goes to the school's guides, with no model call", async () => {
    const siti = await seededStack();
    const matchSymptom = vi.spyOn(siti.school.ai, "matchSymptom");
    const route = await call(
      helpRouter.helpRoute,
      { utterance: "Berapa KKM untuk kelas 4?" },
      { context: siti },
    );
    expect(route).toEqual({ kind: "intent", intent: "tanya", processName: null });
    expect(matchSymptom).not.toHaveBeenCalled();
  });

  it("a question that clearly names a symptom is routed to the process in code", async () => {
    const siti = await seededStack();
    const matchSymptom = vi.spyOn(siti.school.ai, "matchSymptom");
    const route = await call(
      helpRouter.helpRoute,
      { utterance: "Kapan tagihan sudah lewat jatuh tempo?" },
      { context: siti },
    );
    expect(route).toEqual({ kind: "intent", intent: "kenapa", processName: null });
    expect(matchSymptom).not.toHaveBeenCalled();
  });

  it("only a near miss asks the model, once", async () => {
    const siti = await seededStack();
    const matchSymptom = vi.spyOn(siti.school.ai, "matchSymptom");
    await call(
      helpRouter.helpRoute,
      { utterance: "Kalau sudah bayar sebagian kapan terbuka?" },
      { context: siti },
    );
    expect(matchSymptom).toHaveBeenCalledTimes(1);
  });
});
