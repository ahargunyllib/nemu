import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { call } from "@orpc/server";
import { describe, expect, it } from "vite-plus/test";

import { createSchoolContext } from "../../testing/school";
import { documentsRouter } from "./router";

const BPMN = join(
  import.meta.dirname,
  "../../../../ai/src/school/fixtures/pengajuan-izin-guru.bpmn",
);
const OPERATOR = { id: "rizal", role: "operator", workspaceId: "W-SEKOLAH" };

async function operatorContext() {
  const context = await createSchoolContext();
  return {
    ...context,
    session: { ...context.session!, user: { ...context.session!.user, ...OPERATOR } },
  };
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
