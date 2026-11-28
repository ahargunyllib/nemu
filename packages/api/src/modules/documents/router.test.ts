import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { call } from "@orpc/server";
import { describe, expect, it } from "vite-plus/test";

import { createSchoolContext } from "../../testing/school";
import { processesRouter } from "../processes/router";
import { createDocumentRepository } from "./repository";
import { documentsRouter } from "./router";

const BPMN = join(
  import.meta.dirname,
  "../../../../ai/src/school/fixtures/pengajuan-izin-guru.bpmn",
);
const FIXTURES = join(import.meta.dirname, "../../../../ai/src/school/fixtures");
const SOP_PENILAIAN_PDF = join(
  import.meta.dirname,
  "../../../../ai/src/school/fixtures/F3-2_SOP-Penilaian-SDIT-Nusantara.pdf",
);
const OPERATOR = { id: "rizal", role: "operator", workspaceId: "W-SEKOLAH" };
const JAVAN = { id: "javan", role: "admin", workspaceId: "W-SEKOLAH" };

async function operatorContext() {
  const context = await createSchoolContext();
  return {
    ...context,
    session: { ...context.session!, user: { ...context.session!.user, ...OPERATOR } },
  };
}

/** The same database, signed in as Admin Javan, who manages the built-in package (WS-02). */
function asJavan(context: Awaited<ReturnType<typeof operatorContext>>) {
  return {
    ...context,
    session: { ...context.session, user: { ...context.session.user, ...JAVAN } },
  };
}

async function fixtureFile(name: string) {
  return new File([await readFile(join(FIXTURES, name))], name, { type: "application/xml" });
}

describe("WS-04 knowledge", () => {
  it("keeps a BPMN's tasks and end event for the symptom editor, each user task with its page", async () => {
    const context = await operatorContext();
    const file = new File([await readFile(BPMN)], "pengajuan-izin-guru.bpmn");
    const document = await call(
      documentsRouter.uploadDocument,
      {
        title: "Pengajuan Izin Guru",
        version: "1",
        isActive: false,
        file,
        siteIds: ["sekolah-alursekolah"],
      },
      { context },
    );

    const elements = await call(
      documentsRouter.listProcessElements,
      { id: document.id },
      { context },
    );
    expect(elements.map(({ elementId, kind, page }) => [elementId, kind, page])).toEqual(
      expect.arrayContaining([
        ["Task_IsiFormIzin", "task", "Form Izin"],
        ["Task_UnggahSuratDokter", "task", "Surat Dokter"],
        ["End_Izin", "end", null],
      ]),
    );

    await call(
      documentsRouter.saveProcessElement,
      {
        id: document.id,
        elementId: "Task_PersetujuanKepsek",
        symptoms: ["Izin masih menunggu di aplikasi"],
        page: "Persetujuan Izin",
      },
      { context },
    );
    const edited = (
      await call(documentsRouter.listProcessElements, { id: document.id }, { context })
    ).find((element) => element.elementId === "Task_PersetujuanKepsek");
    expect(edited).toMatchObject({
      symptoms: ["Izin masih menunggu di aplikasi"],
      page: "Persetujuan Izin",
      pageEdited: true,
    });
  });

  it("records who uploaded and who switched a document, and the websites it applies to", async () => {
    const context = await operatorContext();
    const file = new File(["## Absensi\n\nAbsensi diisi sebelum pukul 08.00."], "absensi.md");
    const document = await call(
      documentsRouter.uploadDocument,
      { title: "SOP Absensi", version: "1", isActive: false, file, siteIds: [] },
      { context },
    );
    await call(documentsRouter.setDocumentActive, { id: document.id, isActive: true }, { context });
    await call(
      documentsRouter.setDocumentSites,
      { id: document.id, siteIds: ["sekolah-moodle"] },
      { context },
    );

    const listed = await call(documentsRouter.listDocuments, { packageId: null }, { context });
    expect(listed.find((row) => row.id === document.id)).toMatchObject({
      isActive: true,
      siteIds: ["sekolah-moodle"],
      createdByName: "Rizal Hidayat",
      changedByName: "Rizal Hidayat",
    });
  });
});

describe("Dokumen dan alur: a BPMN's tasks in the panel", () => {
  it("says who does each task, the branch that leads to it, and counts tasks and gateways", async () => {
    const context = await operatorContext();
    const document = await call(
      documentsRouter.uploadDocument,
      {
        title: "Catat Hafalan Tahfidz",
        version: "1",
        isActive: true,
        file: await fixtureFile("F3-1_catat-hafalan-tahfidz.bpmn"),
        siteIds: [],
      },
      { context },
    );

    const detail = await call(documentsRouter.getProcessDetail, { id: document.id }, { context });
    expect([detail.taskCount, detail.gatewayCount, detail.unmappedTasks]).toEqual([5, 2, 0]);
    const task = (id: string) => detail.elements.find((element) => element.elementId === id);
    expect(task("Task_Setoran")).toMatchObject({
      performer: "person",
      lane: "Guru",
      branch: "Setoran",
    });
    expect(task("Task_PilihJenis")).toMatchObject({ performer: "person", branch: null });
    expect(task("Task_Hitung")).toMatchObject({
      performer: "system",
      lane: "Sistem AlurSekolah",
      page: null,
    });
    expect(task("End_1")?.performer).toBeNull();

    await expect(
      call(documentsRouter.getProcessDetail, { id: "sop-penilaian-sdit-nusantara" }, { context }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("Dokumen dan alur stats", () => {
  it("counts active knowledge by package and school, BPMN tasks, and the newest recording's steps", async () => {
    const context = await operatorContext();
    const bpmn = fixtureFile;
    await call(
      documentsRouter.uploadDocument,
      {
        title: "Alur SPP",
        version: "1",
        isActive: true,
        file: await bpmn("F2-1_alur-spp.bpmn"),
        siteIds: [],
        packageId: "alursekolah",
      },
      { context: asJavan(context) },
    );
    await call(
      documentsRouter.uploadDocument,
      {
        title: "Catat Hafalan Tahfidz",
        version: "1",
        isActive: true,
        file: await bpmn("F3-1_catat-hafalan-tahfidz.bpmn"),
        siteIds: [],
      },
      { context },
    );
    // An inactive BPMN counts nowhere.
    await call(
      documentsRouter.uploadDocument,
      {
        title: "Pengajuan Izin Guru",
        version: "1",
        isActive: false,
        file: await bpmn("pengajuan-izin-guru.bpmn"),
        siteIds: [],
      },
      { context },
    );
    const procedure = await call(
      processesRouter.procedureCompile,
      {
        title: "Input nilai per kelas",
        events: ["Nilai", "Tampilkan", "Simpan"].map((name, t) => ({
          t,
          type: "click" as const,
          url: "https://alursekolah.example/#/nilai",
          locator: {
            role: "button",
            name,
            label: name,
            placeholder: null,
            css: null,
            relX: null,
            relY: null,
          },
          value: null,
        })),
        narration: [],
      },
      { context },
    );
    const recording = await call(
      processesRouter.procedureSave,
      { title: "Input nilai per kelas", version: "1", isActive: true, procedure },
      { context },
    );
    // Dokumen dan alur says who recorded it.
    const listed = await call(documentsRouter.listDocuments, { packageId: null }, { context });
    expect(listed.find((row) => row.id === recording.id)?.createdByName).toBe("Rizal Hidayat");

    const stats = await call(documentsRouter.knowledgeStats, undefined, { context });
    // The seeded SOP Penilaian, the tahfidz BPMN and the recording are the school's own.
    expect(stats.active).toEqual({ total: 4, package: 1, school: 3 });
    // Alur SPP has 7 tasks, tahfidz 5; each person's task has a page taken from its label.
    expect(stats.processes).toEqual({ count: 2, tasks: 12, unmappedTasks: 0 });
    expect(stats.recordings).toEqual({ count: 1, latestSteps: procedure.steps.length });
  });
});

describe("Dokumen dan alur: package documents for the operator", () => {
  it("lists the package's documents next to the school's, read-only for the operator", async () => {
    const context = await operatorContext();
    const spp = await call(
      documentsRouter.uploadDocument,
      {
        title: "Alur SPP",
        version: "1",
        isActive: true,
        file: await fixtureFile("F2-1_alur-spp.bpmn"),
        siteIds: [],
        packageId: "alursekolah",
      },
      { context: asJavan(context) },
    );

    const forOperator = await call(
      documentsRouter.listDocuments,
      { packageId: null, withPackages: true },
      { context },
    );
    expect(forOperator.find((row) => row.id === spp.id)).toMatchObject({
      packageId: "alursekolah",
      readOnly: true,
    });
    expect(forOperator.find((row) => row.id === "sop-penilaian-sdit-nusantara")).toMatchObject({
      packageId: null,
      readOnly: false,
    });
    const forJavan = await call(
      documentsRouter.listDocuments,
      { packageId: null, withPackages: true },
      { context: asJavan(context) },
    );
    expect(forJavan.find((row) => row.id === spp.id)?.readOnly).toBe(false);
    // Without `withPackages`, WS-04 still lists only the school's own.
    const own = await call(documentsRouter.listDocuments, { packageId: null }, { context });
    expect(own.map((row) => row.id)).not.toContain(spp.id);

    for (const [procedure, input] of [
      [documentsRouter.setDocumentActive, { id: spp.id, isActive: false }],
      [documentsRouter.setDocumentSites, { id: spp.id, siteIds: [] }],
      [documentsRouter.deleteDocument, { id: spp.id }],
    ] as const) {
      await expect(call(procedure as never, input as never, { context })).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
    }
    await expect(
      call(
        documentsRouter.uploadDocument,
        {
          title: "Alur SPP",
          version: "2",
          isActive: false,
          file: await fixtureFile("F2-1_alur-spp.bpmn"),
          siteIds: [],
          packageId: "alursekolah",
        },
        { context },
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    // Admin Javan still switches it.
    await expect(
      call(
        documentsRouter.setDocumentActive,
        { id: spp.id, isActive: false },
        { context: asJavan(context) },
      ),
    ).resolves.toMatchObject({ isActive: false });
  });
});

describe("F3-2: the official SOP Penilaian PDF", () => {
  it("is indexed point by point, each point on its own page, without the running footer", async () => {
    const context = await operatorContext();
    const file = new File([await readFile(SOP_PENILAIAN_PDF)], "SOP-Penilaian.pdf", {
      type: "application/pdf",
    });
    const document = await call(
      documentsRouter.uploadDocument,
      { title: "SOP Penilaian", version: "2026", isActive: true, file, siteIds: [] },
      { context },
    );
    expect(document.status).toBe("ready");

    const chunks = (
      await createDocumentRepository(context.db).listActiveReadyChunks("W-SEKOLAH")
    ).filter((chunk) => chunk.documentId === document.id);
    const at = (article: string) => chunks.find((chunk) => chunk.article === article);

    expect([at("3.2")?.page, at("3.3")?.page, at("4.1")?.page, at("4.3")?.page]).toEqual([
      2, 2, 3, 3,
    ]);
    expect(at("3.2")?.text).toContain("untuk semua mata pelajaran adalah 75");
    expect(at("3.3")?.text).not.toContain("3.4");
    expect(at("4.3")?.text).toContain("Ulangan susulan dilaksanakan paling lambat 14 hari");
    expect(at("5.2")?.text).toBe("5.2 Wali kelas: memastikan nilai kelasnya lengkap.");
    expect(chunks.some((chunk) => chunk.text.includes("DATA UJI SINTETIS"))).toBe(false);
  });
});
