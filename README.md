# Nemu

Nemu is an AI companion in the browser for teachers. It does school administration together with
the teacher on the AlurSekolah, Moodle and government pages she already uses, and answers only from
knowledge the school and Javan manage. The MVP plan (PRD v2.3) is tracked in
[#194](https://github.com/ahargunyllib/nemu/issues/194).

The first MVP, a guide on a fake AlurKerja app, is removed; its last version is tagged
`v1-alurkerja`. Domain terms are defined in [GLOSSARY.md](GLOSSARY.md).

## Products

| Product          | Where                   | What it does                                                                                                                                        |
| ---------------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Nemu Extension   | `apps/extension`        | Chrome/Edge extension: the Nemu button on the school's allowed websites ([README](apps/extension/README.md)).                                       |
| Nemu Service     | `apps/server`           | Cloudflare Worker (Hono + oRPC): the school procedures (`docs/school-ai.md`), knowledge, schools and teachers.                                      |
| Admin Workspace  | `apps/admin`            | Web console for schools, teachers, knowledge documents, Reference Tables, and Rule Sources.                                                         |
| Mock AlurSekolah | `apps/mock-alursekolah` | Fake AlurSekolah the extension runs on, with a read API shaped like AlurSekolah API v1 ([README](apps/mock-alursekolah/README.md)).                 |
| Mock portals     | `apps/mock-portals`     | Static Ruang GTK (F2-3) and e-Rapor (WS-1, not allowed) pages.                                                                                      |
| wa-bot           | `apps/wa-bot`           | Go service on the team VPS that passes grade-book photos sent to the Nemu WhatsApp number on to the Nemu Service ([README](apps/wa-bot/README.md)). |

## Install the Nemu Extension

The extension is one Manifest V3 build that runs in Chrome and Microsoft Edge. Pick one of these
ways to install it.

### From the latest build

Every deploy from `main` builds the extension against the production Nemu Service and puts the zip
on the [`extension-latest` release](https://github.com/ahargunyllib/nemu/releases/tag/extension-latest).

1. Download `nemu-extension-chrome.zip` from that release and unzip it.
2. Open `chrome://extensions` (in Edge, `edge://extensions`) and turn on **Developer mode**.
3. Select **Load unpacked** and pick the unzipped folder.

To update, replace the folder's contents with the new zip and select the reload icon on the
extension card. The version on the card (`0.1.<run number>`) tells you which build you have.

### From your own build

Build against the Nemu Service you want the extension to call. The build stops with an error
when `WXT_SERVER_URL` is missing, so a production build never calls `localhost`:

```bash
WXT_SERVER_URL=https://nemu-api.ahargunyllib.dev pnpm --filter extension build
```

Then load `apps/extension/.output/chrome-mv3` unpacked, as in step 3 above. For development,
`pnpm run dev` builds `apps/extension/.output/chrome-mv3-dev` against your local Nemu Service.

### From the Chrome Web Store and Edge Add-ons

Not live yet. The listing text, permission reasons and privacy answers for an unlisted Chrome Web
Store item and an Edge Add-ons item are ready in
[docs/store-submission.md](docs/store-submission.md). Once a listing is live, install it from its
link like any other extension; this section will then link both listings.

### After installing

The welcome page opens on its own. Select **Izinkan mikrofon** so Nemu can hear spoken questions,
then **Buka pengaturan Nemu** and enter the school's install code. The demo school, SDIT
Nusantara, uses `NEMU-SDITN-2026`. More detail is in
[apps/extension/README.md](apps/extension/README.md).

## Architecture

```
Teacher's browser                    Cloudflare                          Team VPS
┌──────────────────────┐   oRPC    ┌───────────────────────────────┐    ┌──────────────────┐
│ Nemu Extension       │ ────────► │ Nemu Service (Worker)         │ ◄─ │ wa-bot           │
│ (WXT, MV3)           │           │ Hono + oRPC                   │    │ WhatsApp photos  │
│ on AlurSekolah,      │           │ procedure → service → repo    │    ├──────────────────┤
│ Moodle, Ruang GTK    │           │ D1 (data) · R2 (files)        │    │ Moodle test site │
└──────────────────────┘           │ SchoolAi ──► OpenRouter       │    │ (F4 test cases)  │
Admin Workspace (Vite site) ─────► └───────────────────────────────┘    └──────────────────┘
```

- **Nemu Service** (`apps/server`) is a modular monolith on Cloudflare Workers. `apps/server`
  composes it; each feature module in `packages/api` runs procedure → service → repository
  ([docs/agents/backend-architecture.md](docs/agents/backend-architecture.md)). Data lives in
  Cloudflare D1. Uploaded knowledge documents and grade-book photos live in R2; photos are deleted
  once the teacher saves, and an R2 rule removes any left after a day.
- **Alchemy** (`packages/infra/alchemy.run.ts`) describes every Cloudflare resource: the D1
  database, the R2 buckets, the Nemu Service, the mocks and the Admin Workspace. CI deploys it from
  `main`.
- **Nemu Extension** (`apps/extension`) is a WXT Manifest V3 extension. Only its background
  service worker calls the Nemu Service. It identifies the school by its install code and the
  teacher by the email of the account signed in on AlurSekolah, so teachers don't log in to Nemu
  ([ADR-0015](docs/adr/0015-the-extension-knows-the-teacher-without-a-login.md)). Every task Nemu does on a page goes through one executor that fills,
  points and checks, but never presses Simpan, Kirim or Hapus.
- **Admin Workspace** (`apps/admin`) is where the school operator and Javan manage schools,
  teachers, knowledge documents and integrations. It signs in with Better Auth.
- **AI behind one seam.** Every model call goes through the `SchoolAi` interface
  (`packages/ai/src/school/runtime.ts`), passed in through the request context. With
  `NEMU_RESPONDER=fixture` the Nemu Service uses an offline `SchoolAi` that needs no key and no
  network, so tests and demos run without a model
  ([ADR-0001](docs/adr/0001-chat-endpoint-behind-a-responder-seam.md)).

## AI models

The live `SchoolAi` reaches every model through [OpenRouter](https://openrouter.ai). The model IDs
are settings, not code: the defaults below come from `apps/server/.env.schema` and
`packages/infra/alchemy.run.ts`, and each can be changed per deployment.

| Setting                          | Default model                   | What Nemu uses it for                                                                                  |
| -------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `OPENROUTER_SCHOOL_READ_A_MODEL` | `google/gemini-4-hydrogen`      | First reading of a grade-book photo (layout and cell positions), form photos (F3), quiz scripts (F4)   |
| `OPENROUTER_SCHOOL_READ_B_MODEL` | `openai/gpt-6.1-terra`          | Second, independent reading of a grade-book photo, from a different model family                       |
| `OPENROUTER_SCHOOL_REREAD_MODEL` | `google/gemini-4-hydrogen`      | Re-reading the cropped cells the two readings disagree on                                              |
| `OPENROUTER_SCHOOL_TEXT_MODEL`   | `anthropic/claude-haiku-5.5`    | Help answers grounded in the school's knowledge, "ini kenapa?", BPMN steps, field matching, recordings |
| `OPENROUTER_STT_MODEL`           | `microsoft/mai-transcribe-2`    | Speech to text for spoken questions                                                                    |
| `OPENROUTER_TTS_MODEL`           | `microsoft/mai-voice-2.1-flash` | Nemu's voice (voice `id-ID-Harper:MAI-Voice-2.1-Flash`); empty means the browser's own voice speaks    |

Every call asks OpenRouter to deny data collection. `OPENROUTER_ZDR=true` also limits calls to
zero-data-retention endpoints (Gemini is then not available). Knowledge retrieval is keyword
search in code (`packages/ai/src/knowledge.ts`), so it needs no embedding model. Prompts, schemas
and the offline fixtures are described in [docs/school-ai.md](docs/school-ai.md).

## Local models for on-premise use

A school or Javan may want models to run on its own servers. Today the code supports this only in
part, so treat it as an option, not a feature:

- **What works now:** the model IDs are settings, and every model call already goes through the
  `SchoolAi` seam. Nothing outside `packages/ai/src/school` talks to a model.
- **What is missing:** the OpenRouter address is written into the code
  (`https://openrouter.ai/api/v1/...` in `packages/ai/src/school/llm.ts` and `speech.ts`). There is
  no setting for another base URL yet.

To point Nemu at a local OpenAI-compatible server such as Ollama or vLLM, a small change is
needed:

1. Add a base URL setting (for example `OPENROUTER_BASE_URL`, defaulting to
   `https://openrouter.ai/api/v1`) to `apps/server/.env.schema` and `alchemy.run.ts`, and pass it
   to `createSchoolAi`.
2. Use it in place of the fixed address in `llm.ts` and `speech.ts`.
3. Set the model settings to the local model names, for example a vision model for the three
   photo readers and a text model for `OPENROUTER_SCHOOL_TEXT_MODEL`.

Check these points before relying on a local server:

- Nemu calls the **Responses API** (`/responses`) with strict JSON-schema output, images and files.
  The local server must serve that endpoint with image and file input and strict schemas. Support
  for this differs between servers, versions and models, so test each reader before switching.
- The OpenRouter-only `provider` options (data collection, zero data retention) mean nothing to a
  local server and may need to be left out.
- Speech uses `/audio/transcriptions` and `/audio/speech`. Without a local speech server, leave
  `OPENROUTER_TTS_MODEL` empty so the browser's voice speaks.
- The Nemu Service runs on Cloudflare Workers, so the local model server must be reachable from
  the internet (for example through Cloudflare Tunnel), or the Nemu Service must move on-premise
  too.

## Nemu's own flows as BPMN

[docs/bpmn/](docs/bpmn/) holds two of Nemu's flows as BPMN 2.0 files, drawn from what the code does
today. Each opens in [bpmn.io](https://demo.bpmn.io) and in Camunda Modeler:

- `f1-input-nilai.bpmn`: F1 Input Nilai, from the WhatsApp photo to the grades read back from
  AlurSekolah, with cara 1, 2 and 3 (`apps/extension/features/grade-photo` and
  `features/executor`).
- `f4-pasang-kuis.bpmn`: F4 Pasang Kuis, from the teacher's script to a checked quiz in Moodle
  (`features/quiz-import` and `features/quiz-check`).

User tasks (group `guru`) are the teacher's, including "Guru memeriksa" and "Guru menekan Simpan".
Service tasks are calls to the Nemu Service, and script tasks are what the extension does on the
page. `packages/ai/src/school/bpmn/nemu-flows.test.ts` checks that both files parse, that every
element is drawn, and that Nemu's own BPMN reader walks them.

## Repository layout

```
nemu/
├── apps/
│   ├── admin/           # Admin Workspace (React + TanStack Router)
│   ├── extension/       # Nemu Extension (WXT + React)
│   ├── mock-alursekolah/ # Mock AlurSekolah page + read API (Worker + its own D1)
│   ├── mock-portals/    # Static Ruang GTK and e-Rapor mocks
│   ├── server/          # Nemu Service entry point (Hono + oRPC on Workers)
│   └── wa-bot/          # WhatsApp photo intake (Go), runs on the team VPS
├── packages/
│   ├── ai/              # School AI (school/), knowledge retrieval, Rule Sources
│   ├── api/             # Feature modules: procedure → service → repository
│   ├── auth/            # Better Auth configuration
│   ├── config/          # Shared TypeScript config
│   ├── contracts/       # Wire schemas shared by the extension, server, and admin
│   ├── db/              # Drizzle schema and D1 migrations (including demo seeds)
│   ├── infra/           # Alchemy stack: D1, R2, and the Workers
│   └── ui/              # Vendored shadcn components, AppShell, Nemu brand wrappers
├── infra/               # Team VPS: Docker Compose for the Moodle test site and wa-bot
└── docs/                # ADRs, architecture guides, design system, school AI guide, BPMN
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

   To run without OpenRouter, set `NEMU_RESPONDER=fixture`. The server then answers offline
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

   The Nemu Service runs locally the same way it runs on Cloudflare: `alchemy dev` serves the
   Worker with a local D1 database and local R2 buckets, so you need no Cloudflare account. Its
   procedures answer under <http://localhost:3000>. With `NEMU_RESPONDER=fixture` it also needs no
   OpenRouter key.

4. Sign in to the Admin Workspace with a seeded account. The school accounts (Bu Siti, Pak Rizal)
   and how to call the school procedures are in [docs/school-ai.md](docs/school-ai.md). The mock
   AlurSekolah accounts are in [apps/mock-alursekolah/README.md](apps/mock-alursekolah/README.md).

### Local database

`pnpm run dev` runs `alchemy dev`, which creates the local D1 database and applies the
migrations, including the seeded accounts and the `W-SEKOLAH` school workspace. Its state lives in
`packages/infra/.alchemy/`, so each checkout or git worktree gets its own database on its first
run. Copy `apps/server/.env` into a new worktree before starting it. To reset the database, stop
dev and delete `packages/infra/.alchemy/`.

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

- `pnpm --filter @nemu/ai eval:school` evaluates the school AI. See
  [packages/ai/README.md](packages/ai/README.md).

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
on the [`extension-latest` release](https://github.com/ahargunyllib/nemu/releases/tag/extension-latest)
(see [Install the Nemu Extension](#install-the-nemu-extension)).

### Deploy to Cloudflare by hand

To deploy by hand, configure provider accounts once with
`cd packages/infra && pnpm exec alchemy profile edit`, then run `pnpm run deploy`. Manual deploys
go to a personal `dev_<username>` stage on `workers.dev`. After a first deploy, set `CORS_ORIGIN`
in `apps/server/.env` to the deployed Admin Workspace origin (comma-separate any others), and
deploy again.

### Team VPS

What runs outside Cloudflare (the Moodle test site for the F4 cases and `wa-bot` for WhatsApp
photos) is one Docker Compose stack in [`infra/`](infra/), behind Caddy for HTTPS. Deploy it by
hand with [infra/README.md](infra/README.md), which takes about 30 minutes. The same README shows
how to run the Moodle test site on your laptop.

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
