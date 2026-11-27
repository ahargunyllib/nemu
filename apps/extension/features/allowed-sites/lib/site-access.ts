import {
  DEFAULT_SCHOOL_SETTINGS,
  type SchoolSettings,
  type SitePermission,
  sitePermissionFor,
} from "@nemu/contracts/extension";

import type { SiteConfig } from "../../../shared/lib/extension-storage";

/**
 * What a page on the WS-03 list may do: the site's permission (WS-03) and the school's WS-08
 * settings. The content script takes the talk combination from here; the executor reads the same
 * config through `executorSettings`.
 */
export type SiteAccess = { permission: SitePermission; settings: SchoolSettings };

/** The access for `url`, or null when it isn't on the school's list (WS-1 (a)). */
export function siteAccessFor(
  config: SiteConfig | null,
  url: string | undefined,
): SiteAccess | null {
  const permission = sitePermissionFor(config?.allowedSites ?? [], url);
  if (!permission) return null;
  return { permission, settings: config?.settings ?? DEFAULT_SCHOOL_SETTINGS };
}

/** Reads the background's answer defensively; anything unexpected means no access. */
export function parseSiteAccess(response: unknown): SiteAccess | null {
  if (typeof response !== "object" || response === null || !("access" in response)) return null;
  const access = response.access;
  if (typeof access !== "object" || access === null) return null;
  if (!("permission" in access) || !("settings" in access)) return null;
  return access as SiteAccess;
}
