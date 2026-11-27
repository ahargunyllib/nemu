import { readFile } from "node:fs/promises";
import { join } from "node:path";

import type { FormTable, RecordedEvent } from "@nemu/contracts/school";
import { call } from "@orpc/server";
import { describe, expect, it } from "vite-plus/test";

import { BU_SITI, DEMO_ROSTERS } from "@nemu/ai/school/fixtures/sdit-nusantara";

import { createSchoolContext } from "../../testing/school";
import { documentsRouter } from "../documents/router";
import { helpRouter } from "../help/router";
import { inboxRouter } from "../inbox/router";
import { createDemoSchoolDirectory } from "../school/directory";
import { processesRouter } from "./router";

const BPMN = join(
  import.meta.dirname,
  "../../../../ai/src/school/fixtures/pengajuan-izin-guru.bpmn",
);
const RIZAL = { id: "rizal", role: "admin", workspaceId: "W-SEKOLAH" };

async function uploadIzinBpmn(context: Awaited<ReturnType<typeof createSchoolContext>>) {
  const admin = {
    ...context,
    session: { ...context.session!, user: { ...context.session!.user, ...RIZAL } },
  };
  const file = new File([await readFile(BPMN)], "F3-1_pengajuan-izin-guru.bpmn", {
    type: "application/xml",
  });
  return call(
    documentsRouter.uploadDocument,
    { title: "Pengajuan Izin Guru", version: "1", isActive: true, file },
    { context: admin },
  );
}

describe("F3 through the API", () => {
  it("an uploaded BPMN is indexed per task and routes the teacher's sentence to it", async () => {
    const context = await createSchoolContext();
    const document = await uploadIzinBpmn(context);
    expect([document.format, document.status, document.isActive]).toEqual(["bpmn", "ready", true]);

    await expect(call(processesRouter.processList, undefined, { context })).resolves.toEqual([
      { documentId: document.id, title: "Pengajuan Izin Guru", version: "1" },
    ]);
    await expect(
      call(helpRouter.helpRoute, { utterance: "saya mau izin Kamis, anak sakit" }, { context }),
    ).resolves.toEqual({
      kind: "intent",
      intent: "proses",
      processName: "Pengajuan Izin Guru",
    });
  });

  it("F3-1: plan from the sentence, keep slots client-side, and walk to Ajukan and kepsek approval", async () => {
    const context = await createSchoolContext();
    const document = await uploadIzinBpmn(context);
    const first = await call(
      processesRouter.processPlan,
      {
        documentId: document.id,
        text: "izin Kamis, anak sakit",
        answering: null,
        slots: {},
        stepIndex: 0,
      },
      { context },
    );
    expect(first.slots).toEqual({
      jenis_izin: "keperluan_keluarga",
      tanggal_mulai: "2026-12-03",
      lama_hari: 1,
    });
    expect(first.step).toMatchObject({
      kind: "fill",
      sentence: 'Pilih "Keperluan keluarga".',
      because: "Jadi tanpa surat dokter.",
    });
    expect(first.activeTaskId).toBe("Task_IsiFormIzin");

    const sentences: string[] = [];
    for (let stepIndex = 1; stepIndex < first.stepCount + 1; stepIndex += 1) {
      const plan = await call(
        processesRouter.processPlan,
        { documentId: document.id, text: null, answering: null, slots: first.slots, stepIndex },
        { context },
      );
      sentences.push(plan.step.kind === "ask" ? plan.step.question : plan.step.sentence);
    }
    expect(sentences).toEqual([
      "Isi tanggal Kamis, 3 Desember 2026.",
      "Isi lama izin (hari): 1.",
      "Silakan Bu tekan Ajukan.",
      "Setelah diajukan, lanjut ke Persetujuan Kepala Sekolah.",
    ]);
  });

  it("a recorded procedure is compiled, saved as knowledge, cited, and replayed with new values", async () => {
    const context = await createSchoolContext();
    const admin = {
      ...context,
      session: { ...context.session!, user: { ...context.session!.user, ...RIZAL } },
    };
    const at = (
      t: number,
      type: RecordedEvent["type"],
      label: string | null,
      value: string | null,
      role: string | null,
    ): RecordedEvent => ({
      t,
      type,
      url: "https://alursekolah.example/nilai/input",
      locator: { role, name: label, label, placeholder: null, css: null, relX: null, relY: null },
      value,
    });
    const events = [
      at(0, "change", "Kelas", "5A", "combobox"),
      at(1, "change", "Mata pelajaran", "Bahasa Indonesia", "combobox"),
      at(2, "click", "Tampilkan", null, "button"),
      at(3, "click", "Simpan", null, "button"),
    ];
    const procedure = await call(
      processesRouter.procedureCompile,
      { title: "Input nilai per kelas", events, narration: [] },
      { context: admin },
    );
    expect(procedure.parameters.map((parameter) => parameter.name)).toEqual([
      "kelas",
      "mata_pelajaran",
    ]);
    expect(procedure.steps.at(-1)).toMatchObject({
      requiresHumanAction: true,
      instruction: "Silakan tekan Simpan.",
    });

    await expect(
      call(processesRouter.procedureCompile, { title: "x", events, narration: [] }, { context }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    const saved = await call(
      processesRouter.procedureSave,
      { title: "Input nilai per kelas", version: "1", isActive: true, procedure },
      { context: admin },
    );
    expect([saved.format, saved.status]).toEqual(["procedure", "ready"]);

    const run = await call(
      processesRouter.procedureRun,
      { documentId: saved.id, values: { kelas: "4B", mata_pelajaran: "Matematika" } },
      { context },
    );
    expect(run.status === "ok" && run.steps.slice(0, 2).map((step) => step.value)).toEqual([
      "4B",
      "Matematika",
    ]);

    const answer = await call(
      helpRouter.helpAsk,
      { question: "langkah input nilai per kelas tampilkan" },
      { context },
    );
    expect(answer.status).toBe("answered");
  });
});

const FIXTURES = join(import.meta.dirname, "../../../../ai/src/school/fixtures");
const CLASS_4A = [
  "Aisyah Putri Wijaya",
  "Fatih Rizky Wijaya",
  "Zahra Nur Wijaya",
  "Bagas Pratama",
  "Citra Lestari",
  "Dimas Saputra",
  "Elsa Maharani",
  "Gilang Ramadhan",
  "Hana Safitri",
  "Ilham Nugroho",
];

/** Bu Siti teaches tahfidz in 4A (as in WS-06); the tahfidz BPMN uploaded by Pak Rizal. */
async function tahfidzContext() {
  const context = await createSchoolContext();
  context.school.directory = createDemoSchoolDirectory(
    [{ ...BU_SITI, classes: ["4A", "4B"] }],
    [
      ...DEMO_ROSTERS,
      {
        className: "4A",
        students: CLASS_4A.map((name, index) => ({
          studentId: `4a-${index + 1}`,
          name,
          number: index + 1,
        })),
      },
    ],
  );
  const admin = {
    ...context,
    session: { ...context.session!, user: { ...context.session!.user, ...RIZAL } },
  };
  const file = new File(
    [await readFile(join(FIXTURES, "F3-1_catat-hafalan-tahfidz.bpmn"))],
    "F3-1_catat-hafalan-tahfidz.bpmn",
    { type: "application/xml" },
  );
  const document = await call(
    documentsRouter.uploadDocument,
    { title: "Catat Hafalan Tahfidz", version: "1", isActive: true, file },
    { context: admin },
  );
  return { context, admin, document };
}

async function planAll(
  context: Awaited<ReturnType<typeof createSchoolContext>>,
  input: {
    documentId: string;
    text: string | null;
    answering: string | null;
    slots: Record<string, string | number | boolean | null>;
    table?: FormTable | null;
  },
) {
  return call(processesRouter.processPlan, { stepIndex: 0, ...input }, { context });
}

describe("F3-1 setoran tahfidz through the API (#213)", () => {
  it("WS-04's page is the task's page; no page or link means only explaining", async () => {
    const { context, admin, document } = await tahfidzContext();
    const sentence = {
      documentId: document.id,
      text: "Catat setoran hafalan 4A hari ini",
      answering: null,
      slots: {},
    };
    // The page WS-04 took from the label is used until the operator edits it.
    const auto = await planAll(context, sentence);
    expect(auto.tasks[0]).toMatchObject({ page: "Catat Setoran Kelas", pageSource: "mapping" });

    await call(
      documentsRouter.saveProcessElement,
      { id: document.id, elementId: "Task_CatatSetoran", symptoms: [], page: "Al-Quran › Setoran baru" },
      { context: admin },
    );
    const plan = await planAll(context, sentence);
    expect(plan.tasks).toEqual([
      {
        taskId: "Task_CatatSetoran",
        name: "Catat Setoran Kelas",
        page: "Al-Quran › Setoran baru",
        pageSource: "mapping",
        action: "Simpan setoran",
      },
    ]);
    expect(plan.step).toMatchObject({ kind: "ask", slot: "murid" });

    await call(
      documentsRouter.saveProcessElement,
      { id: document.id, elementId: "Task_CatatSetoran", symptoms: [], page: null },
      { context: admin },
    );
    const none = await planAll(context, sentence);
    expect(none.tasks[0]).toMatchObject({ page: null, pageSource: null });
  });

  it("a recording of the task gives its page when WS-04 wasn't edited", async () => {
    const { context, admin, document } = await tahfidzContext();
    const at = (t: number, type: RecordedEvent["type"], name: string, role: string): RecordedEvent => ({
      t,
      type,
      url: "https://alursekolah.example/#/tahfidz",
      locator: { role, name, label: name, placeholder: null, css: null, relX: null, relY: null },
      value: type === "change" ? "4A" : null,
    });
    const procedure = await call(
      processesRouter.procedureCompile,
      {
        title: "Catat setoran kelas",
        events: [
          at(0, "click", "Al-Quran", "link"),
          at(1, "click", "Setoran baru", "button"),
          at(2, "change", "Kelas", "combobox"),
        ],
        narration: [],
      },
      { context: admin },
    );
    await call(
      processesRouter.procedureSave,
      { title: "Catat setoran kelas", version: "1", isActive: true, procedure },
      { context: admin },
    );
    const plan = await planAll(context, {
      documentId: document.id,
      text: "Catat setoran hafalan 4A hari ini",
      answering: null,
      slots: {},
    });
    expect(plan.tasks[0]).toMatchObject({
      page: "Al-Quran › Setoran baru",
      pageSource: "recording",
    });
  });

  it("F3-1: the book photo is read, Citra's Tajwid is asked, and the steps end before Simpan setoran", async () => {
    const { context, document } = await tahfidzContext();
    const photo = new File(
      [await readFile(join(FIXTURES, "F3-1_foto-buku-setoran-tahfidz-4A.png"))],
      "buku-setoran.png",
      { type: "image/png" },
    );
    const job = await call(inboxRouter.inboxUploadPhoto, { file: photo }, { context });
    const first = await planAll(context, {
      documentId: document.id,
      text: "Catat setoran hafalan 4A hari ini",
      answering: null,
      slots: {},
    });
    expect(first.step).toMatchObject({ kind: "ask", taskId: "Task_CatatSetoran" });

    const read = await call(
      processesRouter.processReadPhoto,
      { documentId: document.id, jobId: job.jobId, taskId: first.step.taskId!, slots: first.slots },
      { context },
    );
    if (read.status !== "ok") throw new Error(`photo: ${read.status}`);
    expect(read.questions).toMatchObject([
      { kind: "value", rowName: "Citra Lestari", fieldId: "tajwid", candidates: ["81", "87"] },
    ]);
    const table = {
      ...read.table,
      rows: read.table.rows.map((row) =>
        row.name === "Citra Lestari" ? { ...row, values: { ...row.values, tajwid: "87" } } : row,
      ),
    };
    const plan = await planAll(context, {
      documentId: document.id,
      text: null,
      answering: null,
      slots: read.slots,
      table,
    });
    expect(plan.steps.map((step) => step.kind)).toEqual(["fill", "fill", "rows", "human", "done"]);
    const rows = plan.steps.find((step) => step.kind === "rows");
    expect(rows?.kind === "rows" && rows.rows.map((row) => row.name)).toEqual([
      "Aisyah Putri Wijaya",
      "Bagas Pratama",
      "Citra Lestari",
    ]);
    expect(plan.steps.at(-2)).toMatchObject({ kind: "human", action: "Simpan setoran" });
    expect(plan.announcements).toEqual([
      "Sistem AlurSekolah: hitung nilai hafalan.",
      "Koordinator Tahfidz: periksa rekap tahfidz.",
    ]);
  });

  it("form fields are matched to the labels the page shows", async () => {
    const { context } = await tahfidzContext();
    await expect(
      call(
        processesRouter.processMatchFields,
        {
          fields: [
            { id: "tanggal_setoran", label: "Tanggal setoran" },
            { id: "fashohah", label: "Fashohah" },
          ],
          pageLabels: ["Kelas", "Tanggal setoran", "Fashohah"],
        },
        { context },
      ),
    ).resolves.toEqual({ tanggal_setoran: "Tanggal setoran", fashohah: "Fashohah" });
  });
});
