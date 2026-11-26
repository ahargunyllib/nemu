import type { AllowedSite } from "@nemu/contracts/extension";
import { asc, type Database, eq } from "@nemu/db";
import { allowedSite, schoolInstallCode } from "@nemu/db/schema/extension";
import { workspace } from "@nemu/db/schema/workspace";

export type InstalledSchool = { workspaceId: string; name: string };

/** The install codes (ADR-0015) and the WS-03 allowed websites (ADR-0016) of each school. */
export type ExtensionRepository = {
  schoolForInstallCode(code: string): Promise<InstalledSchool | undefined>;
  listAllowedSites(workspaceId: string): Promise<AllowedSite[]>;
};

export function createExtensionRepository(db: Database): ExtensionRepository {
  return {
    async schoolForInstallCode(code) {
      const [record] = await db
        .select({ workspaceId: workspace.id, name: workspace.name })
        .from(schoolInstallCode)
        .innerJoin(workspace, eq(workspace.id, schoolInstallCode.workspaceId))
        .where(eq(schoolInstallCode.code, code))
        .limit(1);
      return record;
    },
    listAllowedSites(workspaceId) {
      return db
        .select({ pattern: allowedSite.pattern, label: allowedSite.label })
        .from(allowedSite)
        .where(eq(allowedSite.workspaceId, workspaceId))
        .orderBy(asc(allowedSite.createdAt), asc(allowedSite.id));
    },
  };
}
