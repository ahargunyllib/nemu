# Nemu

Nemu is an AI guide in the browser. It walks an employee through a work process inside their
organisation's web app and answers only from knowledge the admin manages. The MVP guides Rina
through one Perjalanan Dinas (official work trip) on the Demo App, a fake AlurKerja.

Domain terms (Momen, Action Level, nemu_id, Answer Card, and the rest) are defined in
[GLOSSARY.md](GLOSSARY.md).

## Products

| Product         | Where                 | What it does                                                                                                       |
| --------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Nemu Extension  | `apps/extension`      | Chrome extension: mascot, Composer, Area Crop, highlights, and navigation clicks, on allowlisted Demo App origins. |
| Nemu Service    | `apps/server`         | Cloudflare Worker (Hono + oRPC): answers `nemuChat`, holds knowledge and Reference Tables, writes the Chat Log.    |
| Admin Workspace | `apps/admin`          | Web console for knowledge documents, Reference Tables, and the Chat Log.                                           |
| Demo App        | `apps/mock-alurkerja` | Fake AlurKerja where the three Momen of Rina's Perjalanan Dinas play out.                                          |

## Repository layout

```
nemu/
├── apps/
│   ├── admin/           # Admin Workspace (React + TanStack Router)
│   ├── extension/       # Nemu Extension (WXT + React)
│   ├── mock-alurkerja/  # Demo App (React + TanStack Router)
│   └── server/          # Nemu Service entry point (Hono + oRPC on Workers)
├── packages/
│   ├── ai/              # runNemu: OpenRouter pipeline, retrieval, calculations, evals
│   ├── api/             # Feature modules: procedure → service → repository
│   ├── auth/            # Better Auth configuration
│   ├── config/          # Shared TypeScript config
│   ├── contracts/       # Wire schemas, nemu_ids, and Momen fixtures shared by every part
│   ├── db/              # Drizzle schema and D1 migrations (including demo seeds)
│   ├── infra/           # Alchemy stack: D1, R2, and the three Workers
│   └── ui/              # Vendored shadcn components, AppShell, Nemu brand wrappers
└── docs/                # ADRs, architecture guides, design system, Demo App reference
```

Stack: TypeScript, React, TanStack Router, Tailwind CSS, shadcn/ui (`base-maia`), Hono, oRPC,
Drizzle, Cloudflare D1 and R2, Better Auth, WXT, Alchemy, Varlock, and Vite+.

## Getting started

1. Install dependencies (this also generates each app's `src/env.ts` from its `.env.schema`):

   ```bash
   pnpm install
   ```

2. Create the server's env file and fill in the secrets:

   ```bash
   cp apps/server/.env.example apps/server/.env
   ```

   To run without OpenRouter, set `NEMU_RESPONDER=fixture`. The server then answers only the
   three Momen prompts from `@nemu/contracts/fixtures` and needs no `OPENROUTER_API_KEY`
   ([ADR-0001](docs/adr/0001-chat-endpoint-behind-a-responder-seam.md)).

3. Start everything:

   ```bash
   pnpm run dev
   ```

   | What                 | Where                                                             |
   | -------------------- | ----------------------------------------------------------------- |
   | Nemu Service         | <http://localhost:3000>                                           |
   | Demo App             | <http://localhost:3001>                                           |
   | Admin Workspace      | <http://localhost:3002>                                           |
   | Nemu Extension (dev) | built into `apps/extension/.output/chrome-mv3-dev`, load unpacked |

4. Sign in to the Demo App with a seeded demo account (Rina, the verifikator, or Dimas as Billing
   Liaison; the login page has one-click buttons), then
   load the extension and press Ctrl+Shift+Space. See [apps/extension/README.md](apps/extension/README.md)
   for loading the extension and the Momen prompts to try.

### Local database

`pnpm run dev` runs `alchemy dev`, which creates the local D1 database and applies the
migrations, including the seeded demo accounts, 3-Momen fixtures, travel knowledge chunks, Reference
Tables, and the isolated `W-TELKO` Knowledge Workspace for Klaim SLA. Its state lives in
`packages/infra/.alchemy/`, so each checkout or git worktree gets its own database on its first
run. Copy `apps/server/.env` into a new worktree before starting it. To reset the database, stop
dev and delete `packages/infra/.alchemy/`. Telco evaluator files under
`data/05_telco/06_test-case` are never indexed by the live AI responder.

After changing the Drizzle schema, generate a migration:

```bash
pnpm run db:generate
```

## Scripts

| Script                        | What it does                                               |
| ----------------------------- | ---------------------------------------------------------- |
| `pnpm run dev`                | Start the server, Demo App, Admin Workspace, and extension |
| `pnpm run dev:mock-alurkerja` | Start only the Demo App                                    |
| `pnpm run dev:admin`          | Start only the Admin Workspace                             |
| `pnpm run build`              | Build every app                                            |
| `pnpm run check`              | Vite+ format and lint checks plus workspace type checks    |
| `pnpm run test`               | Run every package's tests                                  |
| `pnpm run lint`               | Vite+ lint                                                 |
| `pnpm run format`             | Vite+ format                                               |
| `pnpm run db:generate`        | Generate a D1 migration from the Drizzle schema            |
| `pnpm run env:generate`       | Regenerate `src/env.ts` after changing an `.env.schema`    |
| `pnpm run deploy`             | Deploy your personal Alchemy stage                         |
| `pnpm run destroy`            | Tear down your personal Alchemy stage                      |
| `pnpm run hooks:setup`        | Install the Vite+ Git hooks                                |

Package-level commands worth knowing:

- `pnpm --filter extension verify` checks the extension end to end in Playwright's Chromium,
  against `NEMU_RESPONDER=fixture pnpm run dev`.
- `pnpm --filter @nemu/ai eval:offline` and `eval:live` evaluate the AI pipeline; see
  [packages/ai/README.md](packages/ai/README.md). PRD acceptance evidence and remaining
  environment-dependent checks are tracked in [docs/prd-traceability.md](docs/prd-traceability.md).

## Environment

Each app owns its environment schema in `.env.schema`, and Varlock generates a typed `ENV`
accessor in `src/env.ts`. Commit schemas; keep secrets in ignored env files or the deployment
platform. Worker code reads Cloudflare bindings (the `DB` D1 database and the `documents` R2
bucket) from `packages/infra/alchemy.run.ts`; Alchemy loads and validates deployment inputs with
`varlock/auto-load`. Run standalone tools that use Varlock from the owning app's directory so they
pick up that app's schema. See [Varlock's monorepo guide](https://varlock.dev/guides/monorepos/).

## Deployment

Every push to `main` runs CI and then deploys the `prod` stage to Cloudflare:

| Product         | Production URL                                 |
| --------------- | ---------------------------------------------- |
| Nemu Service    | <https://nemu-api.ahargunyllib.dev>            |
| Demo App        | <https://nemu-mock-alurkerja.ahargunyllib.dev> |
| Admin Workspace | <https://nemu-admin.ahargunyllib.dev>          |

The same workflow rebuilds the extension against the production Nemu Service and replaces the zip
on the [`extension-latest` release](https://github.com/ahargunyllib/nemu/releases/tag/extension-latest).

To deploy by hand, configure provider accounts once with
`cd packages/infra && pnpm exec alchemy profile edit`, then run `pnpm run deploy`. Manual deploys
go to a personal `dev_<username>` stage on `workers.dev`. After a first deploy, set `CORS_ORIGIN`
in `apps/server/.env` to the deployed Demo App and Admin Workspace origins, comma-separated, and
deploy again.

## Contributing

`main` accepts changes only through pull requests: keep each one small and single-purpose, with a
conventional-commit title. CI runs `pnpm run check` and `pnpm run test` on every pull request.

Before changing code, read:

- [AGENTS.md](AGENTS.md): conventions for humans and agents alike
- [docs/agents/backend-architecture.md](docs/agents/backend-architecture.md) and
  [docs/agents/frontend-architecture.md](docs/agents/frontend-architecture.md)
- [docs/agents/testing.md](docs/agents/testing.md)
- [docs/design-system.md](docs/design-system.md): how Nemu surfaces look
- [docs/demo-app.md](docs/demo-app.md): Demo App pages, fixtures, demo accounts, and nemu_ids
- [docs/adr/](docs/adr/): architecture decisions
