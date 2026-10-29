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

Build UI by composing the vendored shadcn components in `packages/ui` with their stock variants. Add a missing component with the shadcn CLI from `packages/ui` instead of hand-building it, and use theme tokens such as `primary`, `muted`, and `destructive` rather than ad-hoc colors. Show content that is loading or still being produced as a `Skeleton` shaped like that content; keep `Spinner` for a button whose action is pending. For example, `UserMenu` renders a button-shaped `Skeleton` while the session loads.

What Nemu draws over a page (Composer, Answer Card, target labels, highlights, mascot) follows the Nemu design system in `docs/design-system.md`: it uses the Nemu brand tokens in `packages/ui/src/styles/nemu.css` (`nemu`, `nemu-subtle`, `nemu-ring`, and the rest), while App surfaces keep the shadcn tokens. Give a vendored component a brand look by wrapping it, never by editing it or adding variants to it: a look several features share lives in `packages/ui/src/nemu/` (`@nemu/ui/nemu/<name>`), a one-feature look stays in that feature. For example, `NemuBadge` wraps the stock `Badge` for amber target labels and citation chips.

The Demo App and the Admin Workspace share one signed-in layout from `packages/ui/src/shell` (dark side menu, white top bar, muted page, `PageHeading` titles), so a layout change lands in both. For example, the Admin Workspace moved from its own collapsible sidebar and breadcrumb header onto `AppShell` to match the Demo App. Page content fills the width with the same `px-6` gutter as `AppHeader`, so its edges line up with the top bar; don't center it in a max-width column. For example, Beranda, Ajukan Perjalanan Dinas, My Task, and My Request were moved off a centered `max-w-5xl` column for this.

A design revision changes only how things look. Build the new look on the data the app already has, and leave the fixtures and the AI Responder as they are unless the user asks to change them. For example, the Momen 1 and 2 revision restyled the Demo App and the extension but kept the existing Momen fixtures.

Use a vendored overlay (Sheet, Dialog, Popover) with its stock behaviour: its backdrop, its enter and exit animation, and its dismissal. Don't hide the backdrop or reposition the popup with CSS overrides to make it act like an inline panel; if the design needs a panel that sits beside the page, build a panel, not an overlay. Keep the code that drives it minimal too: no mount effects to force an enter animation and no event filters to second-guess dismissal. A route that renders an overlay holds `open` in state and navigates away in `onOpenChangeComplete`, so the exit animation plays. For example, the Task detail sheet dropped its see-through overlay and under-the-top-bar placement and became a stock Sheet; it also dropped a mount effect and a `<nemu-overlay>` press filter, so it appears without sliding in.

Every vendored component must come from the `base-maia` style set in `packages/ui/components.json`: rounded corners (`rounded-2xl` to `rounded-4xl`) and `text-sm` body text. A component that looks off-style, such as one with sharp `rounded-none` corners or `text-xs/relaxed` text, was copied from another style. Re-add it with `shadcn add <name> --overwrite` from `packages/ui` instead of patching classes by hand. For example, `Dialog` and `Sheet` were re-added this way after the Upload document dialog rendered with sharp corners.

### Demo-only controls

Keep controls that exist only to run the demo out of the Demo App's AlurKerja chrome (header, side menu, page content), so the demo still looks like AlurKerja. Put them on the floating demo dock at the bottom left as separate buttons, not a joined bar that reads as tabs. For example, Panel demo moved from the header to the dock, and Ajukan Perjalanan Dinas adds **Isi formulir demo** there through `useDemoPageAction` (`docs/demo-app.md`).

### Demo App language

Write the Demo App's UI in Indonesian, the language Nemu answers in, so Nemu can quote the label on the screen, and format its dates with the `id-ID` locale. Keep the terms the client's own Indonesian documents use as they are (Service ID, Invoice, Billing, RCA). When a label changes, change every guide, fixture, and test that quotes it in the same PR. For example, AlurKerja's Complete Task became **Selesaikan Tugas** after QA found Nemu telling Rina to press "Kirim" on a button labelled Complete Task (#123). See `docs/demo-app.md`.

### Tests

Co-locate tests with the source they protect and prioritize observable behavior. See `docs/agents/testing.md`.

### Commits and pull requests

`main` accepts changes only through pull requests. Keep each pull request small and single-purpose, with a conventional-commit title.

Don't name or link the external design file the design system was taken from in code, docs, commit messages, branch names, or PRs; refer to `docs/design-system.md` instead. For example, the Nemu brand token PR cites `docs/design-system.md`, not the design file.

Don't add agent attribution: no `Co-Authored-By` trailers in commit messages and no "Generated with" lines in PR descriptions. Include this rule in briefs for any session or subagent you start.

## Agent skills

### Issue tracker

Issues and specs live in GitHub Issues for `ahargunyllib/nemu`, via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
