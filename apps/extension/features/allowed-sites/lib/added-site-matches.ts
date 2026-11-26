/**
 * The granted host permissions the manifest's content script doesn't cover: sites the school
 * added to WS-03 later and the settings page asked for (`optional_host_permissions`). The broad
 * `https://*\/*` itself is never a site, and neither is the Nemu Service.
 */
export function addedSiteMatches(
  granted: readonly string[],
  known: readonly string[],
  serverOrigin: string,
): string[] {
  const skip = new Set([...known, `${serverOrigin}/*`, "https://*/*", "<all_urls>"]);
  return [...new Set(granted.filter((origin) => !skip.has(origin)))];
}
