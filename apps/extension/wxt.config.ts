import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "wxt";

import { DEFAULT_SERVER_URL } from "./shared/lib/config";

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  // Don't auto-launch a browser in dev: it needs Chrome installed, and `pnpm dev` dies without it.
  // Load .output/chrome-mv3-dev unpacked in any Chromium browser instead.
  webExt: { disabled: true },
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  // WXT loads .env files before calling this, so WXT_SERVER_URL is set here too.
  manifest: () => ({
    name: "Nemu",
    description: "Pemandu Perjalanan Dinas di Demo App.",
    host_permissions: [`${new URL(process.env.WXT_SERVER_URL || DEFAULT_SERVER_URL).origin}/*`],
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
