# Frontend Architecture

These rules apply to `apps/mock-alurkerja/src`, `apps/admin/src`, and
`apps/extension` (the Nemu Extension). Shared UI primitives live in
`packages/ui`.

## Source layout

- Keep thin bootstrap files such as `main.tsx`, `routeTree.gen.ts`,
  `index.css`, and `env.public.ts` at the `src` root.
- Organize web application code under `routes/`, `features/`, and `shared/`.
  The dependency direction is:

  ```text
  routes -> features -> shared
  ```

- In the extension, `entrypoints/` plays the role of `routes/`: each entrypoint
  (background, content script, popup) is a composition root, and its code
  lives in `features/` and `shared/` beside it under the same rules.
- Feature and shared slices may use responsibility folders as needed:
  `components/`, `hooks/`, `contexts/`, `stores/`, `types/`, `api/`, and
  `lib/`. Do not create empty folders.
- Do not use vague `model/`, `ui/`, or `utils/` folders.
- Vendored shadcn primitives live in `packages/ui/src/components` and are
  imported as `@nemu/ui/components/<name>`. App-specific components that
  compose them belong to a feature or to `shared/components/`.
- Nemu-branded wrappers around those primitives that several features share
  live in `packages/ui/src/nemu` and are imported as `@nemu/ui/nemu/<name>`;
  their tokens are in `packages/ui/src/styles/nemu.css`. Never edit a vendored
  primitive to brand it.
- The signed-in layout the Demo App and the Admin Workspace share (`AppShell`,
  `AppSidebar`, `AppHeader`, `PageHeading`, `AccountMenu`) lives in
  `packages/ui/src/shell` and is imported as `@nemu/ui/shell/<name>`. Each app
  fills it with its own menu items, account details, and pages.
- Keep domain-specific reusable code inside its feature. For example, Action
  Level labels belong in that feature's `lib/`, not in `shared/`.
- Shared code is a dependency leaf and must not import from `features/` or
  `routes/`.
- Import wire schemas shared with the Nemu Service from `@nemu/contracts`.

## Responsibility folders

- `components/` contains React-rendering `.tsx` modules only. Never place a
  `.ts` helper, type, constant, config, context identity, or hook there.
- `hooks/` contains custom hooks. Every exported `useX` hook belongs here.
- `lib/` contains executable pure helpers, builders, schemas, formatters,
  constants, and configs.
- `types/` contains type-only reusable modules. Keep mixed runtime and type
  exports with the runtime owner in `lib/`.
- `contexts/` contains context identities and contracts. A provider that
  renders React stays in `components/`; its consumer hook belongs in `hooks/`.
- `stores/` is for external observable client state with an independent
  lifecycle or subscriptions. React Query caches and local React state are not
  application stores.
- `api/` contains transport and query modules. The oRPC client, `orpc` query
  utilities, and `queryClient` live in `shared/api/`. Call
  `orpc.<procedure>.queryOptions()` directly where it is used once; move it into
  `features/<feature>/api/` when several components share or compose it.
- Co-locate one-use implementation details with their owner. Extract modules
  only when responsibility or reuse warrants it.

## Routes own pages

- A route module is the page and composition root for that URL.
- Keep `createFileRoute`, `validateSearch`, `beforeLoad`, loaders,
  `loaderDeps`, redirects, and route-context binding in `routes/`. A Zod search
  schema used by one route stays in that route module.
- `routes/` holds route modules only, including no router-ignored `-` prefixed
  helper files; code shared by several routes lives in the owning feature or in
  `shared/`.
- Signed-in pages live under the pathless `_auth` layout, whose `beforeLoad` is
  the session gate and redirects signed-out visitors to `/login`.
- Compose concrete feature sections, hooks, and providers directly in the
  route. Do not create `*-page.tsx` files or a single `*Content`, `*View`, or
  similar page facade.
- Preserve route-level lazy boundaries. Do not import a multi-page feature
  barrel.

## Demo App elements

- Every interactive element in the Demo App has a `data-nemu-id` taken from
  `NEMU_IDS` in `@nemu/contracts/nemu-ids` and a clear accessible label
  (visible text or `aria-label`). Register a new id there before rendering it,
  and never rename one. See `docs/demo-app.md`.

## React composition and state

- Split feature UI into cohesive sections and controls. Move deterministic
  builders, configuration, and types out of TSX.
- Prefer composition with `children` over boolean mode props or render-prop
  facades.
- Use custom hooks or reducers for cohesive local workflows. Use a context
  provider only when the same state and actions are consumed by several
  components across nested boundaries; the provider owns the implementation
  and consumers depend on its state/actions interface.
- Treat roughly 300 lines for a feature TSX module and 200 lines for a route as
  review signals. Split by responsibility instead of mechanically moving lines.
- Do not add app-local `index.ts` barrels or re-export-only files.

## Search parameters

- Every TanStack Router search parameter that is read or written is covered by
  a Zod `validateSearch` schema on the owning route or an applicable pathless
  parent route.
- A search schema shared by several routes lives in the owning feature's
  `lib/`, and each route passes it to its own `validateSearch`.
- Select only the validated values a loader needs in `loaderDeps`.

## Audit

Run these checks after frontend architecture changes:

```bash
# Responsibility placement.
find apps/mock-alurkerja/src apps/admin/src apps/extension -path '*/node_modules' -prune -o -type f -path '*/components/*.ts' -print
find apps/mock-alurkerja/src apps/admin/src apps/extension -path '*/node_modules' -prune -o -type d \( -name model -o -name ui -o -name utils \) -print
rg -l '^export (function|const) use[A-Z]' apps/mock-alurkerja/src apps/admin/src apps/extension -g '*.ts' -g '*.tsx' | rg -v '/hooks/'
rg -l '\bcreateContext\b' apps/mock-alurkerja/src apps/admin/src apps/extension -g '*.ts' -g '*.tsx' | rg -v '/contexts/'

# No page facades or app-local barrels.
find apps/mock-alurkerja/src apps/admin/src apps/extension -path '*/node_modules' -prune -o -type f \( -name '*-page.tsx' -o -name index.ts \) -print

# Route concerns stay out of features; shared remains a dependency leaf.
rg -n '\b(createFileRoute|validateSearch|loaderDeps|beforeLoad|getRouteApi)\b' apps/mock-alurkerja/src/features apps/admin/src/features
rg -n '@/features/|@/routes/' apps/mock-alurkerja/src/shared apps/admin/src/shared

# Review search usage against Zod validators in routes.
rg -n '\b(useSearch|validateSearch|loaderDeps)\b' apps/mock-alurkerja/src apps/admin/src -g '!routeTree.gen.ts'

pnpm check
pnpm build
```
