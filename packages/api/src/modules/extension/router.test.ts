import { call, ORPCError } from "@orpc/server";
import { describe, expect, it } from "vite-plus/test";

import type { ExtensionCredentials } from "../../context";
import { createSchoolContext } from "../../testing/school";
import { helpRouter } from "../help/router";
import { createRegistrySchoolDirectory } from "../school/registry-directory";
import { createSchoolRepository } from "../school/repository";
import { extensionRouter } from "./router";

const INSTALL_CODE = "NEMU-SDITN-2026";
const BU_SITI = "siti.aminah@sditnusantara.sch.id";
// Registered in the mock AlurSekolah as the operator, but not a teacher in WS-06.
const PAK_RIZAL = "rizal.operator@sditnusantara.sch.id";

/** A request from the Nemu Extension: no session, only what it sends as headers (ADR-0014). */
async function fromExtension(extension: ExtensionCredentials) {
  const context = await createSchoolContext();
  const directory = createRegistrySchoolDirectory(createSchoolRepository(context.db));
  return { ...context, session: null, extension, school: { ...context.school, directory } };
}

async function refusal(promise: Promise<unknown>) {
  const error = await promise.then(
    () => null,
    (caught: unknown) => caught,
  );
  if (!(error instanceof ORPCError)) throw new Error("expected the request to be refused");
  return { code: error.code, message: error.message, data: error.data };
}

describe("extension install code (ADR-0014) and WS-03 list (ADR-0015)", () => {
  it("gives the school and its allowed websites for a valid code, however it was typed", async () => {
    const context = await fromExtension({ installCode: " nemu-sditn-2026 ", email: null });
    const config = await call(extensionRouter.extensionConfig, undefined, { context });

    expect(config.schoolName).toBe("SDIT Nusantara");
    expect(config.allowedSites.map((site) => site.pattern)).toEqual(
      expect.arrayContaining([
        "*.alursekolah.id",
        "nemu-alursekolah.ahargunyllib.dev",
        "nemu-ruang-gtk.ahargunyllib.dev",
        "nemu-moodle.ahargunyllib.dev",
      ]),
    );
    // WS-1 (a): no Nemu button on e-Rapor.
    expect(config.allowedSites.map((site) => site.pattern)).not.toContain(
      "nemu-erapor.ahargunyllib.dev",
    );
  });

  it("refuses an unknown install code", async () => {
    const context = await fromExtension({ installCode: "SALAH-123", email: BU_SITI });
    await expect(
      refusal(call(extensionRouter.extensionConfig, undefined, { context })),
    ).resolves.toMatchObject({ code: "UNAUTHORIZED", data: { reason: "invalid_install_code" } });
  });
});

describe("identity from the page email (ID-02, ID-04)", () => {
  it("recognises a registered teacher and asks an unregistered account to see the operator", async () => {
    const siti = await fromExtension({ installCode: INSTALL_CODE, email: BU_SITI });
    await expect(
      call(extensionRouter.extensionIdentify, undefined, { context: siti }),
    ).resolves.toEqual({ status: "registered", name: "Siti Aminah, S.Pd.", honorific: "Bu" });

    const rizal = await fromExtension({ installCode: INSTALL_CODE, email: PAK_RIZAL });
    await expect(
      call(extensionRouter.extensionIdentify, undefined, { context: rizal }),
    ).resolves.toEqual({
      status: "unregistered",
      message: "Akun ini belum didaftarkan. Hubungi Pak Rizal.",
    });
  });

  it("answers a school question for the teacher on the page, and only for a registered one", async () => {
    const siti = await fromExtension({ installCode: INSTALL_CODE, email: BU_SITI });
    await expect(
      call(helpRouter.helpRoute, { utterance: "KKM nilai berapa?" }, { context: siti }),
    ).resolves.toEqual({ kind: "intent", intent: "tanya", processName: null });
    await expect(
      call(helpRouter.helpAsk, { question: "KKM nilai berapa?" }, { context: siti }),
    ).resolves.toMatchObject({ status: "answered" });

    const rizal = await fromExtension({ installCode: INSTALL_CODE, email: PAK_RIZAL });
    await expect(
      refusal(call(helpRouter.helpRoute, { utterance: "KKM berapa?" }, { context: rizal })),
    ).resolves.toEqual({
      code: "FORBIDDEN",
      message: "Akun ini belum didaftarkan. Hubungi Pak Rizal.",
      data: { reason: "unregistered" },
    });
  });

  it("refuses school procedures without a valid code or without a page email", async () => {
    const wrongCode = await fromExtension({ installCode: "SALAH-123", email: BU_SITI });
    await expect(
      refusal(call(helpRouter.helpRoute, { utterance: "KKM?" }, { context: wrongCode })),
    ).resolves.toMatchObject({ code: "UNAUTHORIZED" });

    const signedOut = await fromExtension({ installCode: INSTALL_CODE, email: null });
    await expect(
      refusal(call(helpRouter.helpRoute, { utterance: "KKM?" }, { context: signedOut })),
    ).resolves.toMatchObject({ code: "UNAUTHORIZED", data: { reason: "missing_email" } });

    const anonymous = {
      ...(await fromExtension({ installCode: null, email: null })),
      extension: null,
    };
    await expect(
      refusal(call(helpRouter.helpRoute, { utterance: "KKM?" }, { context: anonymous })),
    ).resolves.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
