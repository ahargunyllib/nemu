import { readFile } from "node:fs/promises";
import { join } from "node:path";

import type { RecordedEvent } from "@nemu/contracts/school";
import { call } from "@orpc/server";
import { describe, expect, it } from "vite-plus/test";

import { createSchoolContext } from "../../testing/school";
import { documentsRouter } from "../documents/router";
import { helpRouter } from "../help/router";
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
