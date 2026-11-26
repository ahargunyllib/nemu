import { extensionConfigSchema, extensionIdentitySchema } from "@nemu/contracts/extension";
import { ORPCError } from "@orpc/server";

import { extensionProcedure } from "../../index";
import { createSchoolRepository } from "../school/repository";
import { createExtensionRepository } from "./repository";
import { identifyTeacher, toIdentity } from "./service";

/** What the Nemu Extension reads before it shows anything on a page (ADR-0014, ADR-0015). */
export const extensionRouter = {
  /** The settings page checks the install code with it; the background reads the WS-03 list. */
  extensionConfig: extensionProcedure
    .output(extensionConfigSchema)
    .handler(async ({ context }) => ({
      schoolName: context.installedSchool.name,
      allowedSites: await createExtensionRepository(context.db).listAllowedSites(
        context.installedSchool.workspaceId,
      ),
    })),

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
};
