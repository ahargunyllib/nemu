import type { AllowedSite } from "@nemu/contracts/extension";
import { storage } from "wxt/utils/storage";

/** The school install code the operator typed into the settings page once (ADR-0015). */
export const installCodeItem = storage.defineItem<string | null>("local:installCode", {
  fallback: null,
});

/** The school and its WS-03 allowed websites, as last read from the Nemu Service. */
export type SiteConfig = { schoolName: string; allowedSites: AllowedSite[]; fetchedAt: number };

export const siteConfigItem = storage.defineItem<SiteConfig | null>("local:siteConfig", {
  fallback: null,
});

/**
 * The email of the account last seen signed in on an AlurSekolah page. Sites without an email of
 * their own (Ruang GTK, Moodle) ask as this teacher; signing out of AlurSekolah clears it.
 */
export const pageEmailItem = storage.defineItem<string | null>("local:pageEmail", {
  fallback: null,
});
