import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { call, ORPCError } from "@orpc/server";
import { describe, expect, it } from "vite-plus/test";

import type { ExtensionCredentials } from "../../context";
import { createSchoolContext, type SchoolTestContext } from "../../testing/school";
import { createRegistrySchoolDirectory } from "../school/registry-directory";
import { createSchoolRepository } from "../school/repository";
import { createDocumentLinkSigner } from "./file-link";
import { createDocumentRepository } from "./repository";
import { documentsRouter } from "./router";

const SOP_PENILAIAN_PDF = join(
  import.meta.dirname,
  "../../../../ai/src/school/fixtures/F3-2_SOP-Penilaian-SDIT-Nusantara.pdf",
);
const SOP_TAHFIDZ_PDF = join(
  import.meta.dirname,
  "../../testing/fixtures/WS-1_SOP-Setoran-Tahfidz-SDIT-Nusantara.pdf",
);
const SEEDED_SOP_KEY = "seed/sekolah/F3-2_SOP-Penilaian-SDIT-Nusantara.pdf";
const BU_SITI: ExtensionCredentials = {
  installCode: "NEMU-SDITN-2026",
  email: "siti.aminah@sditnusantara.sch.id",
};

// The same handler and prefix the Nemu Service mounts (apps/server/src/index.ts).
const handler = new OpenAPIHandler(documentsRouter);

/** A clock the test moves, so a link can expire without waiting. */
function testClock(start = Date.parse("2026-12-01T08:00:00Z")) {
  let now = start;
  return { now: () => now, advance: (ms: number) => (now += ms) };
}

/** Bu Siti asking from the Nemu Extension (ADR-0015), with the SOP Penilaian PDF in the bucket. */
async function fromExtension(clock = testClock()) {
  const base = await createSchoolContext();
  const directory = createRegistrySchoolDirectory(createSchoolRepository(base.db));
  const context: SchoolTestContext = {
    ...base,
    session: null,
    extension: BU_SITI,
    school: { ...base.school, directory },
    documentLinks: createDocumentLinkSigner("test-document-link-secret", clock.now),
  };
  const pdf = await readFile(SOP_PENILAIAN_PDF);
  await context.documentFiles.put(SEEDED_SOP_KEY, pdf.buffer.slice(0), "application/pdf");
  return { context, pdf, clock };
}

/** Pak Rizal (operator) uploads an active document in Pengetahuan sekolah (WS-04). */
function uploadAsOperator(context: SchoolTestContext, file: File) {
  const operator = {
    ...context,
    extension: null,
    session: {
      session: {},
      user: { id: "rizal", role: "operator", workspaceId: "W-SEKOLAH" },
    } as unknown as SchoolTestContext["session"],
  };
  return call(
    documentsRouter.uploadDocument,
    { title: file.name, version: "2026", isActive: true, file, siteIds: [] },
    { context: operator },
  );
}

/** Opens a link in a new tab: a plain GET with no Nemu headers and no session. */
async function open(context: SchoolTestContext, path: string) {
  const { response } = await handler.handle(new Request(`http://nemu.test${path}`), {
    prefix: "/api-reference",
    context: { ...context, session: null, extension: null },
  });
  if (!response) throw new Error(`No route for ${path}`);
  return response;
}

describe("Sumber opens the cited document (#258)", () => {
  it("gives a teacher a link that serves the SOP Penilaian PDF inline", async () => {
    const { context, pdf } = await fromExtension();

    const link = await call(
      documentsRouter.documentFileLink,
      { id: "sop-penilaian-sdit-nusantara" },
      { context },
    );
    expect(link.path).toMatch(/^\/api-reference\/documents\/sop-penilaian-sdit-nusantara\/file\?/);

    const response = await open(context, link.path);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toMatch(
      /^inline; filename="F3-2_SOP-Penilaian-SDIT-Nusantara\.pdf"/,
    );
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array(pdf));
  });

  it("gives no link to a document the school doesn't read: another workspace's, or one switched off", async () => {
    const { context } = await fromExtension();
    // A W-TRAVEL regulation, seeded active.
    await expect(
      call(documentsRouter.documentFileLink, { id: "pmk-113-2012" }, { context }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    await createDocumentRepository(context.db).setActive(
      "W-SEKOLAH",
      "sop-penilaian-sdit-nusantara",
      false,
    );
    await expect(
      call(documentsRouter.documentFileLink, { id: "sop-penilaian-sdit-nusantara" }, { context }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("gives no link to a document that isn't a PDF", async () => {
    const { context } = await fromExtension();
    const markdown = await uploadAsOperator(
      context,
      new File(["## Absensi\n\nAbsensi diisi sebelum pukul 08.00."], "absensi.md"),
    );
    await expect(
      call(documentsRouter.documentFileLink, { id: markdown.id }, { context }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("asks who is signed in on AlurSekolah, like every school request from the extension", async () => {
    const { context } = await fromExtension();
    const stranger = { ...context, extension: { ...BU_SITI, email: "tamu@contoh.test" } };
    const refused = await call(
      documentsRouter.documentFileLink,
      { id: "sop-penilaian-sdit-nusantara" },
      { context: stranger },
    ).catch((error: unknown) => error);
    expect(refused).toBeInstanceOf(ORPCError);
    expect(refused).toMatchObject({ code: "FORBIDDEN" });
  });

  it("serves nothing for a token that was changed, made for another document, or has expired", async () => {
    const { context, clock } = await fromExtension();
    const link = await call(
      documentsRouter.documentFileLink,
      { id: "sop-penilaian-sdit-nusantara" },
      { context },
    );
    const token = new URL(link.path, "http://nemu.test").searchParams.get("token")!;

    const tampered = token.replace(/.$/u, (last) => (last === "A" ? "B" : "A"));
    expect(
      (
        await open(
          context,
          `/api-reference/documents/sop-penilaian-sdit-nusantara/file?token=${tampered}`,
        )
      ).status,
    ).toBe(401);
    expect(
      (
        await open(
          context,
          `/api-reference/documents/kamus-kendala-sdit-nusantara/file?token=${token}`,
        )
      ).status,
    ).toBe(401);
    expect(
      (await open(context, "/api-reference/documents/sop-penilaian-sdit-nusantara/file")).status,
    ).toBe(400);

    clock.advance(9 * 60 * 1000);
    expect((await open(context, link.path)).status).toBe(200);
    clock.advance(60 * 1000);
    const expired = await open(context, link.path);
    expect(expired.status).toBe(401);
    expect(await expired.json()).toMatchObject({
      message: "Tautan dokumen sudah kedaluwarsa. Buka lagi lewat Sumber di Nemu.",
    });
  });

  it("stops serving a link once the document is switched off in WS-04", async () => {
    const { context } = await fromExtension();
    const link = await call(
      documentsRouter.documentFileLink,
      { id: "sop-penilaian-sdit-nusantara" },
      { context },
    );
    await createDocumentRepository(context.db).setActive(
      "W-SEKOLAH",
      "sop-penilaian-sdit-nusantara",
      false,
    );
    expect((await open(context, link.path)).status).toBe(404);
  });

  it("opens a PDF the operator uploaded (WS-1: the SOP Setoran Tahfidz)", async () => {
    const { context } = await fromExtension();
    const pdf = await readFile(SOP_TAHFIDZ_PDF);
    const uploaded = await uploadAsOperator(
      context,
      new File([pdf], "WS-1_SOP-Setoran-Tahfidz-SDIT-Nusantara.pdf"),
    );

    const link = await call(documentsRouter.documentFileLink, { id: uploaded.id }, { context });
    const response = await open(context, link.path);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array(pdf));
  });
});
