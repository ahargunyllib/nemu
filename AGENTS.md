# AGENTS.md

## Agent guidance

### Corrections and conventions

When the user corrects an implementation, design choice, or workflow, apply the correction and capture the reusable rule in this file in the same task. State a rule that applies across features, then give the corrected feature as an example. Put domain terms in `GLOSSARY.md` and feature-specific business decisions in an ADR under `docs/adr/`, and link them here when relevant. Refine existing guidance instead of duplicating it. Do not edit skill files unless the user explicitly asks.

### Backend architecture

The Nemu Service is a modular monolith: `apps/server` composes it, and feature modules in `packages/api` run procedure → service → repository. Follow `docs/agents/backend-architecture.md` for placement, request flow, authentication, Cloudflare lifecycle, configuration, and audit rules.

### Frontend architecture

The Demo App (`apps/mock-alurkerja`) and the Nemu Extension use route-owned (or entrypoint-owned) page composition and responsibility-based feature slices. Follow `docs/agents/frontend-architecture.md` for placement, composition, search validation, and audit rules.

### End-to-end completion

Treat a shared contract or provider response as an intermediate boundary, not a completed feature. A requirement is complete only when its producing service, consuming UI, and observable acceptance path all work together; keep partial layers explicitly marked as partial. For example, the confirmed `fill` action is complete only when the extension renders the user-controlled **Isi** action, applies its value after the click, and detects a later mismatch—not when the AI schema merely emits it. See ADR-0003.

### Third-party providers

Wire in a paid third-party provider only once the user has chosen it. Until then, ship the adapter interface, inject it so tests use a fake, and fail clearly as missing configuration. For example, `nemuChat` reaches OpenRouter only through the `NemuService` seam, so a fixture responder can stand in for it (ADR-0001).

### UI composition

Build UI by composing the vendored shadcn components in `packages/ui` with their stock variants. Add a missing component with the shadcn CLI from `packages/ui` instead of hand-building it, and use theme tokens such as `primary`, `muted`, and `destructive` rather than custom color variants or palettes. Show content that is loading or still being produced as a `Skeleton` shaped like that content; keep `Spinner` for a button whose action is pending. For example, `UserMenu` renders a button-shaped `Skeleton` while the session loads.

Every vendored component must come from the `base-maia` style set in `packages/ui/components.json`: rounded corners (`rounded-2xl` to `rounded-4xl`) and `text-sm` body text. A component that looks off-style, such as one with sharp `rounded-none` corners or `text-xs/relaxed` text, was copied from another style. Re-add it with `shadcn add <name> --overwrite` from `packages/ui` instead of patching classes by hand. For example, `Dialog` and `Sheet` were re-added this way after the Upload document dialog rendered with sharp corners.

### Demo-only controls

Keep controls that exist only to run the demo out of the Demo App's AlurKerja chrome (header, side menu, page content), so the demo still looks like AlurKerja. Put them on the floating demo dock at the bottom left as separate buttons, not a joined bar that reads as tabs. For example, Panel demo moved from the header to the dock, and Ajukan Perjalanan Dinas adds **Isi formulir demo** there through `useDemoPageAction` (`docs/demo-app.md`).

### Tests

Co-locate tests with the source they protect and prioritize observable behavior. See `docs/agents/testing.md`.

### Commits and pull requests

`main` accepts changes only through pull requests. Keep each pull request small and single-purpose, with a conventional-commit title.

Don't add agent attribution: no `Co-Authored-By` trailers in commit messages and no "Generated with" lines in PR descriptions. Include this rule in briefs for any session or subagent you start.

## Agent skills

### Issue tracker

Issues and specs live in GitHub Issues for `ahargunyllib/nemu`, via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
