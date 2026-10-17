# Backend Architecture

These rules apply to the Nemu Service: `apps/server`, `packages/api`,
`packages/auth`, `packages/db`, `packages/ai`, and `packages/contracts`.

## Source layout

- `apps/server/src` is the composition root. `index.ts` builds the Hono app
  (logging, CORS, Better Auth handler, oRPC and OpenAPI handlers), `context.ts`
  builds the per-request oRPC context, and `services.ts` wires concrete
  dependencies (database, auth, AI providers) from `env.server.ts`. Keep
  business rules out of it.
- Business code lives in `packages/api/src`, organized by feature under
  `modules/<feature>/`; do not create global `controllers/`, `services/`, or
  `repositories/` layers. `routers/index.ts` only merges the feature routers
  into `appRouter`.
- `packages/ai` is the AI pipeline (`runNemu`) and stays free of Hono, oRPC,
  D1, and Chrome dependencies. The API reaches it only through the
  `NemuService` seam in the context (ADR-0001).
- `packages/db` owns the Drizzle schema, one file per feature under
  `src/schema/`, and the generated migrations. `packages/auth` owns the Better
  Auth configuration.
- Wire schemas shared with the Nemu Extension and the web app live in
  `@nemu/contracts`. A procedure's input and output schemas come from there
  whenever a client other than the web app calls it.
- Keep provider-specific adapters close to their owner. OpenRouter adapters
  belong to `packages/ai`; anything else a single feature calls belongs to that
  feature's module.

## Request flow

Use a pragmatic procedure-service-repository flow:

```text
oRPC procedure -> service -> repository -> Drizzle / D1
                     \-> provider adapter (through the context)
```

- `router.ts` holds the feature's procedures. A procedure owns input and output
  validation, the public/protected choice, and translating failures into
  `ORPCError`. It must not contain multi-step workflows or Drizzle queries.
- `service.ts` owns business rules and workflows that coordinate more than one
  operation. It takes explicit dependencies (`db`, the user id, a provider)
  instead of the whole oRPC context.
- `repository.ts` owns non-trivial or reused Drizzle queries. Do not create a
  repository for a single obvious query.
- Small modules may omit `service.ts` or `repository.ts` when the procedure is
  already thin. Layers are earned by responsibility, not required
  ceremonially. For example, `nemuChat` only validates, injects the
  authenticated user id, and calls `context.nemu.respond`.
- Domain and provider failures become `ORPCError` only in the procedure or a
  shared interceptor.

## Authentication

- Better Auth is the identity provider and session boundary. Reuse its server
  APIs instead of recreating session, OAuth, or CSRF behavior.
- Every user-facing procedure uses `protectedProcedure` and takes the user id
  from `context.session`, never from the request body. `publicProcedure` is for
  health checks and deliberately public reads.

## Cloudflare lifecycle

- Await work required to produce a correct response or keep data consistent.
- Pass non-critical work (logging, delivery, callbacks) to the Worker's
  `waitUntil`, and handle and log its rejection.
- Every promise is either awaited or passed to `waitUntil`.

## Configuration and deployment

- `packages/infra/alchemy.run.ts` declares every Worker binding and value.
  `Config.Redacted` is for secrets, `Config.String` for plain values.
- Each app reads its environment only through its generated `ENV` module
  (`apps/server/src/env.server.ts`, `apps/web/src/env.public.ts`). When adding a
  value, declare it in that app's `.env.schema` and in `alchemy.run.ts`, then
  run `pnpm env:generate`.
- Schema changes go through `pnpm db:generate`; commit the generated migration
  with the schema change. Alchemy applies migrations on deploy.

## Audit

Run these checks after backend architecture changes:

```bash
# Procedures do not own Drizzle queries; expect no output.
rg -n '\.(select|insert|update|delete)\(' packages/api/src/modules -g 'router.ts'

# The AI pipeline stays framework-free; expect no output.
rg -n "from \"(hono|@orpc/|@nemu/db|@nemu/api)" packages/ai/src

# The user id comes from the session.
rg -n 'input\.user_id|input\.userId' packages/api/src

# Background work is tracked.
rg -n 'waitUntil|\.then\(|void [A-Za-z].*\(' apps/server/src packages/api/src -g '*.ts'

pnpm check
pnpm test
pnpm build
```
