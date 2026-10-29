import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "wxt";

import { ALLOWED_MATCHES, DEFAULT_SERVER_URL } from "./shared/lib/config";

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  // Don't auto-launch a browser in dev: it needs Chrome installed, and `pnpm dev` dies without it.
  // Load .output/chrome-mv3-dev unpacked in any Chromium browser instead.
  webExt: { disabled: true },
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  hooks: {
    // A production build without it would call localhost, so every chat fails with "Failed to
    // fetch". The check lives here because `wxt prepare` (postinstall) resolves the manifest too.
    "build:before": (wxt) => {
      if (wxt.config.mode === "production" && !process.env.WXT_SERVER_URL)
        throw new Error(
          "WXT_SERVER_URL is not set. Set it to the Nemu Service URL before `wxt build` or `wxt zip`.",
        );
    },
  },
  // WXT loads .env files before calling this, so WXT_SERVER_URL is set here too.
  manifest: () => ({
    name: "Nemu",
    // The extension-latest release job sets this per run, so a tester can read which build they
    // have in chrome://extensions. Local builds keep package.json's 0.0.0.
    version: process.env.WXT_EXTENSION_VERSION,
    description: "Pemandu Perjalanan Dinas di Demo App.",
    // Only the Nemu Service and the Demo App, so Chrome doesn't warn "read and change all your data
    // on all websites" at install (ADR-0004). The trade-off: `captureVisibleTab` for the Area Crop
    // needs `<all_urls>` or an `activeTab` grant, and a Demo App host permission isn't enough.
    // `activeTab` is granted only when the toolbar icon or the shortcut fires the action on that
    // tab, until it navigates away. Opening the Composer from the mascot grants nothing, and Arc
    // fires the action without a tab, so there the Area Crop fails with a hint to use the icon.
    permissions: ["activeTab"],
    host_permissions: [
      `${new URL(process.env.WXT_SERVER_URL || DEFAULT_SERVER_URL).origin}/*`,
      ...ALLOWED_MATCHES,
    ],
    // The shortcut and the toolbar icon both trigger the action, which opens the Composer.
    // It's bound to the built-in `_execute_action` command because Arc never fires custom
    // commands. The browser handles the keys before the page sees them, and users can rebind
    // them at chrome://extensions/shortcuts (arc://extensions/shortcuts in Arc).
    action: { default_title: "Buka Composer Nemu" },
    commands: {
      _execute_action: {
        suggested_key: { default: "Ctrl+Shift+Space", mac: "MacCtrl+Shift+Space" },
      },
    },
  }),
});
