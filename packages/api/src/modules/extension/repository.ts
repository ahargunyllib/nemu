import {
  type AllowedSite,
  DEFAULT_SCHOOL_SETTINGS,
  type SchoolSettings,
} from "@nemu/contracts/extension";
import { and, asc, type Database, eq } from "@nemu/db";
import { allowedSite, schoolInstallCode, schoolSetting } from "@nemu/db/schema/extension";
import { workspace } from "@nemu/db/schema/workspace";

export type InstalledSchool = { workspaceId: string; name: string };
export type AllowedSiteRecord = AllowedSite & { id: string };

/** The install codes (ADR-0015), the WS-03 allowed websites (ADR-0016) and WS-08 settings. */
export type ExtensionRepository = {
  schoolForInstallCode(code: string): Promise<InstalledSchool | undefined>;
  listAllowedSites(workspaceId: string): Promise<AllowedSiteRecord[]>;
  insertAllowedSite(workspaceId: string, site: AllowedSiteRecord): Promise<void>;
  updateAllowedSite(workspaceId: string, site: AllowedSiteRecord): Promise<boolean>;
  deleteAllowedSite(workspaceId: string, id: string): Promise<boolean>;
  schoolSettings(workspaceId: string): Promise<SchoolSettings>;
  saveSchoolSettings(workspaceId: string, settings: SchoolSettings, userId: string): Promise<void>;
};

const SITE_COLUMNS = {
  id: allowedSite.id,
  pattern: allowedSite.pattern,
  label: allowedSite.label,
  permission: allowedSite.permission,
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
        .select(SITE_COLUMNS)
        .from(allowedSite)
        .where(eq(allowedSite.workspaceId, workspaceId))
        .orderBy(asc(allowedSite.createdAt), asc(allowedSite.id));
    },
    async insertAllowedSite(workspaceId, site) {
      await db.insert(allowedSite).values({ ...site, workspaceId });
    },
    async updateAllowedSite(workspaceId, { id, ...changes }) {
      const updated = await db
        .update(allowedSite)
        .set(changes)
        .where(and(eq(allowedSite.workspaceId, workspaceId), eq(allowedSite.id, id)))
        .returning({ id: allowedSite.id });
      return updated.length > 0;
    },
    async deleteAllowedSite(workspaceId, id) {
      const deleted = await db
        .delete(allowedSite)
        .where(and(eq(allowedSite.workspaceId, workspaceId), eq(allowedSite.id, id)))
        .returning({ id: allowedSite.id });
      return deleted.length > 0;
    },
    async schoolSettings(workspaceId) {
      const [row] = await db
        .select({
          talkShortcut: schoolSetting.talkShortcut,
          defaultCara: schoolSetting.defaultCara,
          fillSpeed: schoolSetting.fillSpeed,
        })
        .from(schoolSetting)
        .where(eq(schoolSetting.workspaceId, workspaceId))
        .limit(1);
      return row ?? DEFAULT_SCHOOL_SETTINGS;
    },
    async saveSchoolSettings(workspaceId, settings, userId) {
      await db
        .insert(schoolSetting)
        .values({ workspaceId, ...settings, updatedBy: userId })
        .onConflictDoUpdate({
          target: schoolSetting.workspaceId,
          set: { ...settings, updatedBy: userId, updatedAt: new Date() },
        });
    },
  };
}
