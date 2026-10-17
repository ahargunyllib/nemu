import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "wxt";

import { DEFAULT_SERVER_URL } from "./shared/lib/config";

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  // WXT loads .env files before calling this, so WXT_SERVER_URL is set here too.
  manifest: () => ({
    name: "Nemu",
    description: "Pemandu Perjalanan Dinas di Demo App.",
    host_permissions: [`${new URL(process.env.WXT_SERVER_URL || DEFAULT_SERVER_URL).origin}/*`],
  }),
});
