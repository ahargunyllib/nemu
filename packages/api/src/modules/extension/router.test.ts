import { sitePermissionFor } from "@nemu/contracts/extension";
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

/** A request from the Nemu Extension: no session, only what it sends as headers (ADR-0015). */
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

describe("extension install code (ADR-0015) and WS-03 list (ADR-0016)", () => {
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
      message: "Akun Ibu belum didaftarkan di Nemu.",
      email: PAK_RIZAL,
      operator: { name: "Pak Rizal", phone: "6281200001003" },
    });
  });

  it("still names the sentence, without an operator to message, when WS-06 has none", async () => {
    const rizal = await fromExtension({ installCode: INSTALL_CODE, email: PAK_RIZAL });
    await createSchoolRepository(rizal.db).deleteContact("W-SEKOLAH", "operator");
    await expect(
      call(extensionRouter.extensionIdentify, undefined, { context: rizal }),
    ).resolves.toEqual({
      status: "unregistered",
      message: "Akun Ibu belum didaftarkan di Nemu. Minta operator sekolah mendaftarkannya.",
      email: PAK_RIZAL,
      operator: null,
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
      message: "Akun Ibu belum didaftarkan di Nemu.",
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

describe("WS-03 permissions and WS-08 settings reach the extension without an update", () => {
  const ADMIN_JAVAN = { id: "javan", role: "admin", workspaceId: "W-SEKOLAH" };
  const OPERATOR = { id: "rizal", role: "operator", workspaceId: "W-SEKOLAH" };

  async function asAdmin(user = ADMIN_JAVAN) {
    const context = await createSchoolContext();
    return {
      ...context,
      session: { ...context.session!, user: { ...context.session!.user, ...user } },
    };
  }

  it("serves what Admin Javan saves: a new site with its permission and the school's settings", async () => {
    const admin = await asAdmin();
    await call(
      extensionRouter.saveAllowedSite,
      { id: null, pattern: "https://Portal.Dinas.go.id/login", label: "", permission: "read_only" },
      { context: admin },
    );
    await call(
      extensionRouter.saveSchoolSettings,
      { talkShortcut: "alt + shift + n", defaultCara: "tunjuk", fillSpeed: "pelan" },
      { context: admin },
    );

    const extension = {
      ...admin,
      session: null,
      extension: { installCode: INSTALL_CODE, email: null },
    };
    const config = await call(extensionRouter.extensionConfig, undefined, { context: extension });
    expect(config.allowedSites).toContainEqual({
      pattern: "portal.dinas.go.id",
      label: "portal.dinas.go.id",
      permission: "read_only",
    });
    expect(
      config.allowedSites.find((site) => site.pattern === "*.alursekolah.id")?.permission,
    ).toBe("read_fill");
    expect(config.settings).toEqual({
      talkShortcut: "Alt+Shift+N",
      defaultCara: "tunjuk",
      fillSpeed: "pelan",
    });
  });

  it("WS-1 (a): the test pack's sites 1-4 get Nemu, e-Rapor (site 5, not entered) doesn't", async () => {
    const admin = await asAdmin();
    const official = [
      ["sdit-nusantara.alursekolah.id", "read_fill"],
      ["moodle-uji.tim-nemu", "read_fill"],
      ["https://web.whatsapp.com", "prepare_message"],
      ["ruang-gtk.tiruan.local", "read_only"],
    ] as const;
    for (const [pattern, permission] of official) {
      await call(
        extensionRouter.saveAllowedSite,
        { id: null, pattern, label: "", permission },
        { context: admin },
      );
    }

    const extension = {
      ...admin,
      session: null,
      extension: { installCode: INSTALL_CODE, email: null },
    };
    const { allowedSites } = await call(extensionRouter.extensionConfig, undefined, {
      context: extension,
    });
    expect(sitePermissionFor(allowedSites, "http://erapor.tiruan.local/")).toBeNull();
    expect(sitePermissionFor(allowedSites, "https://sdit-nusantara.alursekolah.id/nilai")).toBe(
      "read_fill",
    );
    expect(sitePermissionFor(allowedSites, "https://moodle-uji.tim-nemu/mod/quiz/")).toBe(
      "read_fill",
    );
    expect(sitePermissionFor(allowedSites, "https://web.whatsapp.com/")).toBe("prepare_message");
    expect(sitePermissionFor(allowedSites, "http://ruang-gtk.tiruan.local/")).toBe("read_only");
  });

  it("defaults to Ctrl + Space, cara 1 and normal speed, and refuses a bare key", async () => {
    const admin = await asAdmin();
    await expect(
      call(extensionRouter.getSchoolSettings, undefined, { context: admin }),
    ).resolves.toEqual({
      talkShortcut: "Ctrl+Space",
      defaultCara: "isi",
      fillSpeed: "normal",
    });
    await expect(
      call(
        extensionRouter.saveSchoolSettings,
        { talkShortcut: "Space", defaultCara: "isi", fillSpeed: "normal" },
        { context: admin },
      ),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("refuses a duplicate site, and keeps WS-03 and WS-08 from a school operator", async () => {
    const admin = await asAdmin();
    await expect(
      call(
        extensionRouter.saveAllowedSite,
        { id: null, pattern: "*.AlurSekolah.id", label: "Lagi", permission: "read_fill" },
        { context: admin },
      ),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    const operator = await asAdmin(OPERATOR);
    await expect(
      call(extensionRouter.deleteAllowedSite, { id: "sekolah-alursekolah" }, { context: operator }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      call(extensionRouter.getSchoolSettings, undefined, { context: operator }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
