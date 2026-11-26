# Nemu

Nemu is an AI companion in the browser for teachers. It does school administration together with
the teacher on the AlurSekolah, Moodle and government pages she already uses, and answers only from
knowledge the school and Javan manage. The MVP plan (PRD v2.3) is tracked in
[#194](https://github.com/ahargunyllib/nemu/issues/194).

The repo is moving from the first MVP, a guide on a fake AlurKerja app. Its Demo App is removed;
the chat pipeline, Perjalanan Dinas and Klaim SLA code stay until the extension runs on the school
procedures. Domain terms, including the legacy ones, are defined in [GLOSSARY.md](GLOSSARY.md).
The last AlurKerja version is tagged `v1-alurkerja`.

## Products

| Product          | Where                   | What it does                                                                                                                        |
| ---------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Nemu Extension   | `apps/extension`        | Chrome extension. Still the AlurKerja guide (Composer, Answer Card, highlights) until it moves to AlurSekolah.                      |
| Nemu Service     | `apps/server`           | Cloudflare Worker (Hono + oRPC): the school procedures (`docs/school-ai.md`), `nemuChat`, knowledge, the Chat Log.                  |
| Admin Workspace  | `apps/admin`            | Web console for knowledge documents, Reference Tables, Rule Sources, and the Chat Log.                                              |
| Mock AlurSekolah | `apps/mock-alursekolah` | Fake AlurSekolah the extension runs on, with a read API shaped like AlurSekolah API v1 ([README](apps/mock-alursekolah/README.md)). |
| Mock portals     | `apps/mock-portals`     | Static Ruang GTK (F2-3) and e-Rapor (WS-1, not allowed) pages.                                                                      |

## Repository layout

```
nemu/
├── apps/
│   ├── admin/           # Admin Workspace (React + TanStack Router)
│   ├── extension/       # Nemu Extension (WXT + React)
│   ├── mock-alursekolah/ # Mock AlurSekolah page + read API (Worker + its own D1)
│   ├── mock-portals/    # Static Ruang GTK and e-Rapor mocks
│   └── server/          # Nemu Service entry point (Hono + oRPC on Workers)
├── packages/
│   ├── ai/              # School AI (school/) and the legacy runNemu pipeline, retrieval, evals
│   ├── api/             # Feature modules: procedure → service → repository
│   ├── auth/            # Better Auth configuration
│   ├── config/          # Shared TypeScript config
│   ├── contracts/       # Wire schemas, nemu_ids, and Momen fixtures shared by every part
│   ├── db/              # Drizzle schema and D1 migrations (including demo seeds)
│   ├── infra/           # Alchemy stack: D1, R2, and the Workers
│   └── ui/              # Vendored shadcn components, AppShell, Nemu brand wrappers
└── docs/                # ADRs, architecture guides, design system, school AI guide
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

   To run without OpenRouter, set `NEMU_RESPONDER=fixture`. The server then answers from fixtures
   and needs no `OPENROUTER_API_KEY`
   ([ADR-0001](docs/adr/0001-chat-endpoint-behind-a-responder-seam.md), `docs/school-ai.md`).

3. Start everything:

   ```bash
   pnpm run dev
   ```

   | What                 | Where                                                             |
   | -------------------- | ----------------------------------------------------------------- |
   | Nemu Service         | <http://localhost:3000>                                           |
   | Admin Workspace      | <http://localhost:3002>                                           |
   | Mock AlurSekolah     | <http://localhost:3003>                                           |
   | Mock Ruang GTK       | <http://localhost:3004>                                           |
   | Mock e-Rapor         | <http://localhost:3005>                                           |
   | Nemu Extension (dev) | built into `apps/extension/.output/chrome-mv3-dev`, load unpacked |

4. Sign in to the Admin Workspace with a seeded account. The school accounts (Bu Siti, Pak Rizal)
   and how to call the school procedures are in [docs/school-ai.md](docs/school-ai.md). The mock
   AlurSekolah accounts are in [apps/mock-alursekolah/README.md](apps/mock-alursekolah/README.md).

### Local database

`pnpm run dev` runs `alchemy dev`, which creates the local D1 database and applies the
migrations, including the seeded accounts, the `W-SEKOLAH` school workspace, and the legacy
Perjalanan Dinas and Klaim SLA data. Its state lives in
`packages/infra/.alchemy/`, so each checkout or git worktree gets its own database on its first
run. Copy `apps/server/.env` into a new worktree before starting it. To reset the database, stop
dev and delete `packages/infra/.alchemy/`. Telco evaluator files under
`data/05_telco/06_test-case` are never indexed by the live AI responder.

After changing the Drizzle schema, generate a migration:

```bash
pnpm run db:generate
```

## Scripts

| Script                  | What it does                                            |
| ----------------------- | ------------------------------------------------------- |
| `pnpm run dev`          | Start the server, Admin Workspace, and extension        |
| `pnpm run dev:admin`    | Start only the Admin Workspace                          |
| `pnpm run build`        | Build every app                                         |
| `pnpm run check`        | Vite+ format and lint checks plus workspace type checks |
| `pnpm run test`         | Run every package's tests                               |
| `pnpm run lint`         | Vite+ lint                                              |
| `pnpm run format`       | Vite+ format                                            |
| `pnpm run db:generate`  | Generate a D1 migration from the Drizzle schema         |
| `pnpm run env:generate` | Regenerate `src/env.ts` after changing an `.env.schema` |
| `pnpm run deploy`       | Deploy your personal Alchemy stage                      |
| `pnpm run destroy`      | Tear down your personal Alchemy stage                   |
| `pnpm run hooks:setup`  | Install the Vite+ Git hooks                             |

Package-level commands worth knowing:

- `pnpm --filter @nemu/ai eval:school` evaluates the school AI; `eval:offline` and `eval:live`
  evaluate the legacy AlurKerja pipeline. See [packages/ai/README.md](packages/ai/README.md).

## Environment

Each app owns its environment schema in `.env.schema`, and Varlock generates a typed `ENV`
accessor in `src/env.ts`. Commit schemas; keep secrets in ignored env files or the deployment
platform. Worker code reads Cloudflare bindings (the `DB` D1 database and the `documents` R2
bucket) from `packages/infra/alchemy.run.ts`; Alchemy loads and validates deployment inputs with
`varlock/auto-load`. Run standalone tools that use Varlock from the owning app's directory so they
pick up that app's schema. See [Varlock's monorepo guide](https://varlock.dev/guides/monorepos/).

## Deployment

Every push to `main` runs CI and then deploys the `prod` stage to Cloudflare:

| Product         | Production URL                        |
| --------------- | ------------------------------------- |
| Nemu Service    | <https://nemu-api.ahargunyllib.dev>   |
| Admin Workspace | <https://nemu-admin.ahargunyllib.dev> |

The same workflow rebuilds the extension against the production Nemu Service and replaces the zip
on the [`extension-latest` release](https://github.com/ahargunyllib/nemu/releases/tag/extension-latest).

To deploy by hand, configure provider accounts once with
`cd packages/infra && pnpm exec alchemy profile edit`, then run `pnpm run deploy`. Manual deploys
go to a personal `dev_<username>` stage on `workers.dev`. After a first deploy, set `CORS_ORIGIN`
in `apps/server/.env` to the deployed Admin Workspace origin (comma-separate any others), and
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
- [docs/school-ai.md](docs/school-ai.md): the school procedures, accounts, and flows
- [docs/adr/](docs/adr/): architecture decisions
