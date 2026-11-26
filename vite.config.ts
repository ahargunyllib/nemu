import { defineConfig } from "vite-plus";

export default defineConfig({
  lint: {
    ignorePatterns: [
      "node_modules/**",
      "**/node_modules/**",
      "apps/admin/dist/**",
      "apps/admin/.tanstack/**",
      "apps/admin/src/routeTree.gen.ts",
      "apps/server/dist/**",
      "apps/extension/.output/**",
      "apps/extension/.wxt/**",
      "packages/db/dist/**",
      "packages/api/dist/**",
      "packages/auth/dist/**",
      "packages/ai/src/demo.generated.ts",
      "data/**",
      ".alchemy/**",
      ".wrangler/**",
      "**/.wrangler/**",
    ],
    options: {
      typeAware: false,
      typeCheck: false,
    },
  },
  fmt: {
    ignorePatterns: [
      "node_modules/**",
      "**/node_modules/**",
      "apps/admin/dist/**",
      "apps/admin/.tanstack/**",
      "apps/admin/src/routeTree.gen.ts",
      "apps/server/dist/**",
      "apps/extension/.output/**",
      "apps/extension/.wxt/**",
      "packages/db/dist/**",
      "packages/api/dist/**",
      "packages/auth/dist/**",
      "packages/ai/src/demo.generated.ts",
      "data/**",
      ".alchemy/**",
      ".wrangler/**",
      "**/.wrangler/**",
      // Ported from the test-data mocks; kept as written so they diff cleanly against the originals.
      "apps/mock-alursekolah/public/**",
      "apps/mock-portals/**",
    ],
    singleQuote: false,
    semi: true,
    sortPackageJson: true,
  },
  staged: {
    "*.{js,ts,jsx,tsx,vue,svelte,json,jsonc,css,md}": "vp check --fix",
  },
});
