import { z } from "zod";

/**
 * What the Nemu Extension sends with every request instead of a login (ADR-0015): the school's
 * install code from its settings page, and the email of the account signed in on the page.
 */
export const EXTENSION_HEADERS = {
  installCode: "x-nemu-install-code",
  email: "x-nemu-email",
} as const;

export const installCodeSchema = z.string().trim().min(4).max(64);

/**
 * One WS-03 allowed website. `pattern` is a host (`nemu-moodle.ahargunyllib.dev`), a wildcard host
 * that also covers its apex (`*.alursekolah.id`), or either with a port (`localhost:3003`).
 */
/**
 * What Nemu may do on a WS-03 site: read the page and fill fields (`read_fill`), prepare a message
 * the teacher sends herself (`prepare_message`), or only read and point (`read_only`).
 */
export const sitePermissionSchema = z.enum(["read_fill", "prepare_message", "read_only"]);
export type SitePermission = z.infer<typeof sitePermissionSchema>;

export const allowedSiteSchema = z
  .object({ pattern: z.string().min(1), label: z.string(), permission: sitePermissionSchema })
  .strict();

/** Cara 1 Nemu isi · cara 2 Nemu tunjukkan · cara 3 guru isi, Nemu cek (PRD §6.1). */
export const caraSchema = z.enum(["isi", "tunjuk", "cek"]);
export type Cara = z.infer<typeof caraSchema>;

/** How fast cara 1 fills; `normal` is about one field a second. */
export const fillSpeedSchema = z.enum(["pelan", "normal", "cepat"]);
export type FillSpeed = z.infer<typeof fillSpeedSchema>;

/** The pause between two fields in cara 1; "Pelan" during a run halves the speed again. */
export const FILL_INTERVAL_MS: Record<FillSpeed, number> = {
  pelan: 2000,
  normal: 1000,
  cepat: 500,
};

/** WS-08: how Nemu works for every teacher of the school. */
export const schoolSettingsSchema = z
  .object({
    /** The combination held to talk, as "Ctrl+Space" (see `parseShortcut`). */
    talkShortcut: z.string().min(1),
    defaultCara: caraSchema,
    fillSpeed: fillSpeedSchema,
  })
  .strict();
export type SchoolSettings = z.infer<typeof schoolSettingsSchema>;

export const DEFAULT_SCHOOL_SETTINGS: SchoolSettings = {
  talkShortcut: "Ctrl+Space",
  defaultCara: "isi",
  fillSpeed: "normal",
};

/** What the settings page and the background read with the install code alone. */
export const extensionConfigSchema = z
  .object({
    schoolName: z.string(),
    allowedSites: z.array(allowedSiteSchema),
    settings: schoolSettingsSchema,
  })
  .strict();

/** Who the email on the page is at this school (ID-02). */
export const extensionIdentitySchema = z.discriminatedUnion("status", [
  z
    .object({
      status: z.literal("registered"),
      name: z.string(),
      honorific: z.enum(["Bu", "Pak"]),
    })
    .strict(),
  z.object({ status: z.literal("unregistered"), message: z.string() }).strict(),
]);

export type AllowedSite = z.infer<typeof allowedSiteSchema>;
export type ExtensionConfig = z.infer<typeof extensionConfigSchema>;
export type ExtensionIdentity = z.infer<typeof extensionIdentitySchema>;

/** Why a school procedure refused an extension request; the extension shows `message` as is. */
export const EXTENSION_REFUSALS = {
  invalidInstallCode: "invalid_install_code",
  missingEmail: "missing_email",
  unregistered: "unregistered",
} as const;

function parsePattern(pattern: string): { host: string; wildcard: boolean; port: string | null } {
  const [hostPart = "", port = null] = pattern.trim().toLowerCase().split(":");
  const wildcard = hostPart.startsWith("*.");
  return { host: wildcard ? hostPart.slice(2) : hostPart, wildcard, port };
}

/** Whether an http(s) page URL is on a WS-03 site; anything else (chrome://, file:) never is. */
export function siteMatches(pattern: string, url: string): boolean {
  if (!URL.canParse(url)) return false;
  const page = new URL(url);
  if (page.protocol !== "https:" && page.protocol !== "http:") return false;
  const site = parsePattern(pattern);
  if (!site.host) return false;
  // `localhost:443` is the local Moodle on https://localhost, whose URL carries no port.
  const pagePort = page.port || (page.protocol === "https:" ? "443" : "80");
  if (site.port !== null && pagePort !== site.port) return false;
  const hostname = page.hostname.toLowerCase();
  return site.wildcard
    ? hostname === site.host || hostname.endsWith(`.${site.host}`)
    : hostname === site.host;
}

export function isAllowedUrl(
  sites: readonly Pick<AllowedSite, "pattern">[],
  url: string | undefined,
): boolean {
  return !!url && sites.some((site) => siteMatches(site.pattern, url));
}

const PERMISSION_RANK: Record<SitePermission, number> = {
  read_only: 0,
  prepare_message: 1,
  read_fill: 2,
};

/**
 * What Nemu may do on the page at `url`, or null off the WS-03 list. When two sites cover the page
 * (`*.alursekolah.id` and one tenant), the narrower permission wins.
 */
export function sitePermissionFor(
  // A list cached before WS-03 had permissions carries none: it could read and fill.
  sites: readonly (Pick<AllowedSite, "pattern"> & { permission?: SitePermission })[],
  url: string | undefined,
): SitePermission | null {
  if (!url) return null;
  let permission: SitePermission | null = null;
  for (const site of sites) {
    if (!siteMatches(site.pattern, url)) continue;
    const own = site.permission ?? "read_fill";
    if (permission === null || PERMISSION_RANK[own] < PERMISSION_RANK[permission]) {
      permission = own;
    }
  }
  return permission;
}

/** Whether Nemu may type into fields on a site with this permission ("baca saja" may not). */
export function mayFill(permission: SitePermission | null): boolean {
  return permission === "read_fill";
}

/**
 * The Chrome match pattern a site needs as a host permission: http for localhost (https on port
 * 443), https otherwise. Chrome match patterns take no port, so `localhost:3003` becomes
 * `http://localhost/*`.
 */
export function hostPermissionFor(pattern: string): string {
  const site = parsePattern(pattern);
  const local = site.host === "localhost" || site.host === "127.0.0.1";
  const scheme = local && site.port !== "443" ? "http" : "https";
  return `${scheme}://${site.wildcard ? "*." : ""}${site.host}/*`;
}
