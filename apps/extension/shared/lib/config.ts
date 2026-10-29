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

/**
 * The Demo App that goes with the Nemu Service at `serverUrl`: the local one for a local service,
 * else the deployed one. The toolbar popup on other sites opens it.
 */
export function demoAppUrl(serverUrl: string): string {
  const local = new URL(serverUrl).hostname === "localhost";
  const origin = ALLOWED_ORIGINS.find(
    (candidate) => (new URL(candidate).hostname === "localhost") === local,
  );
  return origin ?? ALLOWED_ORIGINS[0] ?? serverUrl;
}

/** Nemu Service used when `WXT_SERVER_URL` is not set at build time. */
export const DEFAULT_SERVER_URL = "http://localhost:3000";
