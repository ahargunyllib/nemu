import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "wxt";

import { DEFAULT_SERVER_URL, KNOWN_SITE_MATCHES, OPTIONAL_SITE_MATCHES } from "./shared/lib/config";

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  // Don't auto-launch a browser in dev: it needs Chrome installed, and `pnpm dev` dies without it.
  // Load .output/chrome-mv3-dev unpacked in Chrome or Edge instead.
  webExt: { disabled: true },
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  hooks: {
    // A production build without it would call localhost, so every request fails. The check lives
    // here because `wxt prepare` (postinstall) resolves the manifest too.
    "build:before": (wxt) => {
      if (wxt.config.mode === "production" && !process.env.WXT_SERVER_URL)
        throw new Error(
          "WXT_SERVER_URL is not set. Set it to the Nemu Service URL before `wxt build` or `wxt zip`.",
        );
    },
  },
  // WXT loads .env files before calling this, so WXT_SERVER_URL is set here too. One MV3 manifest
  // serves Chrome and Edge (both Chromium), so the same build loads unpacked in either.
  manifest: () => ({
    name: "Nemu",
    // The extension-latest release job sets this per run, so a tester can read which build they
    // have in chrome://extensions. Local builds keep package.json's 0.0.0.
    version: process.env.WXT_EXTENSION_VERSION,
    description: "Nemu membantu guru di AlurSekolah, Moodle, dan portal pemerintah.",
    // `storage` keeps the install code; `scripting` runs Nemu on sites granted later (ADR-0016).
    // The microphone belongs to each site, asked for on the first hold there (ADR-0019).
    permissions: ["storage", "scripting"],
    // Known sites are granted at install; inside them the school's WS-03 list decides where the
    // Nemu button appears. Other sites are asked for from the settings page.
    host_permissions: [
      `${new URL(process.env.WXT_SERVER_URL || DEFAULT_SERVER_URL).origin}/*`,
      ...KNOWN_SITE_MATCHES,
    ],
    optional_host_permissions: [...OPTIONAL_SITE_MATCHES],
    // The content script's stylesheet, for sites granted later that the manifest's script misses.
    web_accessible_resources: [
      { resources: ["content-scripts/nemu.css"], matches: [...OPTIONAL_SITE_MATCHES] },
    ],
    // The toolbar icon opens the settings page (entrypoints/options).
    action: { default_title: "Pengaturan Nemu" },
  }),
});
