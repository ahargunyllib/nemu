/** Nemu Service used when `WXT_SERVER_URL` is not set at build time. */
export const DEFAULT_SERVER_URL = "http://localhost:3000";

export function serverUrl(): string {
  return (import.meta.env.WXT_SERVER_URL || DEFAULT_SERVER_URL).replace(/\/$/, "");
}

/** Admin Workspace used when `WXT_ADMIN_URL` is not set at build time ("Lihat diagram"). */
export const DEFAULT_ADMIN_URL = "http://localhost:3002";

export function adminUrl(): string {
  return (import.meta.env.WXT_ADMIN_URL || DEFAULT_ADMIN_URL).replace(/\/$/, "");
}

/**
 * The sites the extension can reach from install (ADR-0016): AlurSekolah tenants, the mocks, the
 * Moodle test site, and WhatsApp Web. `http://localhost/*` covers every local dev port. Inside
 * them the WS-03 list still decides where the Nemu button appears; a site the school adds later
 * is granted from the settings page through `optional_host_permissions`.
 */
export const KNOWN_SITE_MATCHES: readonly string[] = [
  "https://*.alursekolah.id/*",
  "https://nemu-alursekolah.ahargunyllib.dev/*",
  "https://nemu-ruang-gtk.ahargunyllib.dev/*",
  "https://nemu-moodle.ahargunyllib.dev/*",
  "https://web.whatsapp.com/*",
  "http://localhost/*",
];

export const OPTIONAL_SITE_MATCHES: readonly string[] = ["https://*/*"];
