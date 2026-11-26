import { browser } from "wxt/browser";

import { KNOWN_SITE_MATCHES, serverUrl } from "../../../shared/lib/config";
import { addedSiteMatches } from "../lib/added-site-matches";

const SCRIPT_ID = "nemu-added-sites";
// The file WXT builds from entrypoints/nemu.content.
const CONTENT_SCRIPT = "content-scripts/nemu.js";

/**
 * Runs the Nemu content script on sites granted from the settings page, which the manifest's own
 * content script doesn't match. Inside them the WS-03 list still decides, as everywhere else.
 */
export async function syncAddedSiteScripts() {
  const granted = (await browser.permissions.getAll()).origins ?? [];
  const matches = addedSiteMatches(granted, KNOWN_SITE_MATCHES, serverUrl());
  const registered = await browser.scripting.getRegisteredContentScripts({ ids: [SCRIPT_ID] });
  if (registered.length > 0) await browser.scripting.unregisterContentScripts({ ids: [SCRIPT_ID] });
  if (matches.length === 0) return;
  await browser.scripting.registerContentScripts([
    { id: SCRIPT_ID, matches, js: [CONTENT_SCRIPT], runAt: "document_idle" },
  ]);
}
