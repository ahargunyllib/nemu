import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { workspace } from "@nemu/db/schema/workspace";
import { call } from "@orpc/server";
import { describe, expect, it } from "vite-plus/test";

import { createSchoolContext, type SchoolTestContext } from "../../testing/school";
import { createDocumentRepository } from "../documents/repository";
import { documentsRouter } from "../documents/router";
import { createKamusRepository } from "../kamus/repository";
import { helpRouter } from "./router";
import { ask } from "./service";

const SOP_TAHFIDZ = join(
  import.meta.dirname,
  "../../testing/fixtures/WS-1_SOP-Setoran-Tahfidz-SDIT-Nusantara.pdf",
);
const QUESTION = "Setoran minimal berapa ayat?";
const OPERATOR = { id: "rizal", role: "operator", workspaceId: "W-SEKOLAH" };
const ADMIN_JAVAN = { id: "javan", role: "admin", workspaceId: "W-SEKOLAH" };

function as(context: SchoolTestContext, user: typeof OPERATOR) {
  return {
    ...context,
    session: { ...context.session!, user: { ...context.session!.user, ...user } },
  };
}

async function uploadSopTahfidz(
  context: SchoolTestContext,
  packageId: "alursekolah" | null = null,
) {
  const file = new File(
    [await readFile(SOP_TAHFIDZ)],
    "WS-1_SOP-Setoran-Tahfidz-SDIT-Nusantara.pdf",
    {
      type: "application/pdf",
    },
  );
  return call(
    documentsRouter.uploadDocument,
    { title: "SOP Tahfidz", version: "2026", isActive: false, file, siteIds: [], packageId },
    { context },
  );
}

describe("WS-1 (b): the official SOP Tahfidz PDF, tried before and after activation", () => {
  it("answers the same in Uji jawaban (inactive) and for a teacher once it is active", async () => {
    const context = await createSchoolContext();
    const operator = as(context, OPERATOR);
    const sop = await uploadSopTahfidz(operator);
    expect([sop.status, sop.isActive]).toEqual(["ready", false]);

    // Inactive: a teacher's answer doesn't come from it yet.
    const before = await call(helpRouter.helpAsk, { question: QUESTION }, { context });
    expect(JSON.stringify(before)).not.toContain(sop.id);

    const tried = await call(
      helpRouter.helpTryAnswer,
      { question: QUESTION, documentIds: [sop.id] },
      { context: operator },
    );
    expect(tried).toMatchObject({
      status: "answered",
      answer: expect.stringContaining("3 ayat"),
      citations: [
        expect.objectContaining({
          docId: sop.id,
          title: "SOP Tahfidz",
          page: 1,
          article: "3 ayat 3.2",
          quote: expect.stringContaining("Setiap setoran paling sedikit 3 ayat"),
        }),
      ],
    });

    await call(
      documentsRouter.setDocumentActive,
      { id: sop.id, isActive: true },
      {
        context: operator,
      },
    );
    await expect(call(helpRouter.helpAsk, { question: QUESTION }, { context })).resolves.toEqual(
      tried,
    );
  });

  it("is open to the operator, not to a teacher", async () => {
    const context = await createSchoolContext();
    await expect(
      call(helpRouter.helpTryAnswer, { question: QUESTION, documentIds: [] }, { context }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("WS-02: the built-in AlurSekolah package for every school", () => {
  it("answers another school from an active package document only while the flag is on", async () => {
    const context = await createSchoolContext();
    const javan = as(context, ADMIN_JAVAN);
    const sop = await uploadSopTahfidz(javan, "alursekolah");
    await call(
      documentsRouter.setDocumentActive,
      { id: sop.id, isActive: true },
      { context: javan },
    );
    await context.db
      .insert(workspace)
      .values({ id: "W-SEKOLAH-2", name: "SD Contoh", domain: "school" });

    const deps = {
      ai: context.school.ai,
      documents: createDocumentRepository(context.db),
      kamus: createKamusRepository(context.db),
    };
    await expect(ask(deps, "W-SEKOLAH-2", QUESTION)).resolves.toMatchObject({
      status: "answered",
    });

    await call(documentsRouter.setPackageAllSchools, { allSchools: false }, { context: javan });
    await expect(ask(deps, "W-SEKOLAH-2", QUESTION)).resolves.toMatchObject({
      status: "not_in_guide",
    });
    // The owner still answers from its own package documents.
    await expect(ask(deps, "W-SEKOLAH", QUESTION)).resolves.toMatchObject({ status: "answered" });

    // WS-04 lists the school's own knowledge; the package documents are WS-02's.
    const own = await call(documentsRouter.listDocuments, { packageId: null }, { context: javan });
    expect(own.map((document) => document.id)).not.toContain(sop.id);
    const inPackage = await call(
      documentsRouter.listDocuments,
      { packageId: "alursekolah" },
      { context: javan },
    );
    expect(inPackage).toEqual([
      expect.objectContaining({ id: sop.id, createdByName: "Admin Javan" }),
      expect.objectContaining({ id: "tentang-nemu" }),
    ]);
  });

  it("lets only Admin Javan change the flag", async () => {
    const context = await createSchoolContext();
    await expect(
      call(
        documentsRouter.setPackageAllSchools,
        { allSchools: false },
        {
          context: as(context, OPERATOR),
        },
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
