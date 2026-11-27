import type { AllowedSite, SchoolSettings } from "@nemu/contracts/extension";
import { formatShortcut, parseShortcut } from "@nemu/contracts/talk-shortcut";

import type { AllowedSiteRecord, ExtensionRepository } from "./repository";

/** WS-03 and WS-08: what Admin Javan sets for a school and the extension follows. */

export type SiteWriteResult = "ok" | "not_found" | "pattern_taken" | "invalid_pattern";

/**
 * "https://Portal.Sekolah.sch.id/login" → "portal.sekolah.sch.id": the host (with `*.` and a port
 * kept) that `siteMatches` compares, or null for text that names no host.
 */
export function normalizeSitePattern(text: string): string | null {
  const trimmed = text
    .trim()
    .toLowerCase()
    .replace(/^[a-z]+:\/\//u, "")
    .replace(/[/?#].*$/u, "");
  return /^(\*\.)?[a-z0-9-]+(\.[a-z0-9-]+)*(:\d{1,5})?$/u.test(trimmed) ? trimmed : null;
}

export async function saveAllowedSite(
  extension: Pick<
    ExtensionRepository,
    "listAllowedSites" | "insertAllowedSite" | "updateAllowedSite"
  >,
  workspaceId: string,
  input: AllowedSite & { id: string | null },
): Promise<SiteWriteResult> {
  const pattern = normalizeSitePattern(input.pattern);
  if (!pattern) return "invalid_pattern";
  const sites = await extension.listAllowedSites(workspaceId);
  if (sites.some((site) => site.pattern === pattern && site.id !== input.id)) {
    return "pattern_taken";
  }
  const site: AllowedSiteRecord = {
    id: input.id ?? crypto.randomUUID(),
    pattern,
    label: input.label.trim() || pattern,
    permission: input.permission,
  };
  if (!input.id) {
    await extension.insertAllowedSite(workspaceId, site);
    return "ok";
  }
  return (await extension.updateAllowedSite(workspaceId, site)) ? "ok" : "not_found";
}

/** Stores the talk combination in one form, or null when it isn't a combination Nemu can hear. */
export async function saveSchoolSettings(
  extension: Pick<ExtensionRepository, "saveSchoolSettings">,
  workspaceId: string,
  userId: string,
  settings: SchoolSettings,
): Promise<SchoolSettings | null> {
  const shortcut = parseShortcut(settings.talkShortcut);
  if (!shortcut) return null;
  const saved = { ...settings, talkShortcut: formatShortcut(shortcut) };
  await extension.saveSchoolSettings(workspaceId, saved, userId);
  return saved;
}
