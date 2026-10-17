/**
 * Demo App origins where the Nemu Extension runs. Every other page gets no
 * overlay and sends nothing to the Nemu Service.
 */
export const ALLOWED_ORIGINS: readonly string[] = [
  "http://localhost:3001",
  "https://nemu-mock-alurkerja.ahargunyllib.dev",
];

export const ALLOWED_MATCHES = ALLOWED_ORIGINS.map((origin) => `${origin}/*`);

export function isAllowedPage(url: string | undefined): boolean {
  if (!url || !URL.canParse(url)) return false;
  return ALLOWED_ORIGINS.includes(new URL(url).origin);
}

/** Nemu Service used when `WXT_SERVER_URL` is not set at build time. */
export const DEFAULT_SERVER_URL = "http://localhost:3000";
