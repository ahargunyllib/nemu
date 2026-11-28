import {
  allowedSiteSchema,
  extensionConfigSchema,
  extensionIdentitySchema,
  schoolSettingsSchema,
  sitePermissionSchema,
} from "@nemu/contracts/extension";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

import { extensionProcedure, schoolAdminProcedure, schoolFullAdminProcedure } from "../../index";
import { createSchoolRepository } from "../school/repository";
import { createExtensionRepository } from "./repository";
import { identifyTeacher, toIdentity } from "./service";
import { saveAllowedSite, saveSchoolSettings } from "./settings";

/** What the Nemu Extension reads before it shows anything on a page (ADR-0015, ADR-0016). */
export const extensionRouter = {
  /**
   * The settings page checks the install code with it; the background reads the WS-03 list and
   * the WS-08 settings, at most a minute old, so a change reaches every teacher without an update.
   */
  extensionConfig: extensionProcedure.output(extensionConfigSchema).handler(async ({ context }) => {
    const extension = createExtensionRepository(context.db);
    const { workspaceId, name } = context.installedSchool;
    const [sites, settings] = await Promise.all([
      extension.listAllowedSites(workspaceId),
      extension.schoolSettings(workspaceId),
    ]);
    return {
      schoolName: name,
      allowedSites: sites.map(({ pattern, label, permission }) => ({
        pattern,
        label,
        permission,
      })),
      settings,
    };
  }),

  /** ID-02/ID-04: who the account signed in on the page is, asked again whenever it changes. */
  extensionIdentify: extensionProcedure
    .output(extensionIdentitySchema)
    .handler(async ({ context }) => {
      const email = context.extension?.email?.trim();
      if (!email) throw new ORPCError("BAD_REQUEST", { message: "Send the page's email" });
      return toIdentity(
        await identifyTeacher(
          { directory: context.school.directory, school: createSchoolRepository(context.db) },
          context.installedSchool,
          email,
        ),
      );
    }),

  /**
   * WS-03: the school's allowed websites and what Nemu may do on each. The operator and Admin Javan
   * both add, change and remove them (ADR-0022); WS-04 reads them to say where a document applies.
   */
  listAllowedSites: schoolAdminProcedure
    .output(z.array(allowedSiteSchema.extend({ id: z.string() })))
    .handler(({ context }) =>
      createExtensionRepository(context.db).listAllowedSites(context.session.user.workspaceId),
    ),

  saveAllowedSite: schoolAdminProcedure
    .input(
      z.object({
        id: z.string().min(1).nullable(),
        pattern: z.string().trim().min(1).max(200),
        label: z.string().trim().max(120),
        permission: sitePermissionSchema,
      }),
    )
    .handler(async ({ context, input }) => {
      const result = await saveAllowedSite(
        createExtensionRepository(context.db),
        context.session.user.workspaceId,
        input,
      );
      if (result === "invalid_pattern") {
        throw new ORPCError("BAD_REQUEST", {
          message:
            "Tulis alamat situsnya saja, misalnya portal.sekolah.sch.id atau *.alursekolah.id",
        });
      }
      if (result === "pattern_taken") {
        throw new ORPCError("CONFLICT", { message: "Situs ini sudah ada di daftar" });
      }
      if (result === "not_found")
        throw new ORPCError("NOT_FOUND", { message: "Situs tidak ditemukan" });
    }),

  deleteAllowedSite: schoolAdminProcedure
    .input(z.object({ id: z.string().min(1) }))
    .handler(async ({ context, input }) => {
      const deleted = await createExtensionRepository(context.db).deleteAllowedSite(
        context.session.user.workspaceId,
        input.id,
      );
      if (!deleted) throw new ORPCError("NOT_FOUND", { message: "Situs tidak ditemukan" });
    }),

  /** WS-08: how Nemu works for every teacher of the school. The operator reads it (ADR-0022). */
  getSchoolSettings: schoolAdminProcedure
    .output(schoolSettingsSchema)
    .handler(({ context }) =>
      createExtensionRepository(context.db).schoolSettings(context.session.user.workspaceId),
    ),

  /** Only Admin Javan changes WS-08 (ADR-0022). */
  saveSchoolSettings: schoolFullAdminProcedure
    .input(schoolSettingsSchema.extend({ talkShortcut: z.string().trim().min(1).max(40) }))
    .output(schoolSettingsSchema)
    .handler(async ({ context, input }) => {
      const saved = await saveSchoolSettings(
        createExtensionRepository(context.db),
        context.session.user.workspaceId,
        context.session.user.id,
        input,
      );
      if (!saved) {
        throw new ORPCError("BAD_REQUEST", {
          message:
            "Kombinasi tombol perlu satu tombol pengubah (Ctrl, Alt, Shift) dan satu huruf, angka, atau Spasi",
        });
      }
      return saved;
    }),
};
