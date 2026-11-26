import { z } from "zod";

/**
 * What the Nemu Extension sends with every request instead of a login (ADR-0014): the school's
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
export const allowedSiteSchema = z
  .object({ pattern: z.string().min(1), label: z.string() })
  .strict();

/** What the settings page and the background read with the install code alone. */
export const extensionConfigSchema = z
  .object({ schoolName: z.string(), allowedSites: z.array(allowedSiteSchema) })
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
  if (site.port !== null && page.port !== site.port) return false;
  const hostname = page.hostname.toLowerCase();
  return site.wildcard
    ? hostname === site.host || hostname.endsWith(`.${site.host}`)
    : hostname === site.host;
}

export function isAllowedUrl(sites: readonly AllowedSite[], url: string | undefined): boolean {
  return !!url && sites.some((site) => siteMatches(site.pattern, url));
}

/**
 * The Chrome match pattern a site needs as a host permission: http for localhost, https otherwise.
 * Chrome match patterns take no port, so `localhost:3003` becomes `http://localhost/*`.
 */
export function hostPermissionFor(pattern: string): string {
  const site = parsePattern(pattern);
  const scheme = site.host === "localhost" || site.host === "127.0.0.1" ? "http" : "https";
  return `${scheme}://${site.wildcard ? "*." : ""}${site.host}/*`;
}
