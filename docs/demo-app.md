# Demo App

The Demo App (`apps/mock-alurkerja`) is our fake AlurKerja. It carries no Javan or
AlurKerja logos.

## Look

The real AlurKerja App (`app.alurkerja.com`) is built on shadcn with the
`base-maia` style and the `neutral` base color, Figtree for body text, and
Outfit for headings. The shared theme in `packages/ui/src/styles/globals.css`
copies those tokens, so the Demo App, Admin Workspace, and Nemu Extension use
the same palette and fonts. Our vendored components still use the `base-lyra`
style, so they have square corners where AlurKerja uses pill-shaped buttons and
inputs.

## Pages

| Page                    | Path                       |
| ----------------------- | -------------------------- |
| Login                   | `/login`                   |
| Beranda                 | `/`                        |
| Ajukan Perjalanan Dinas | `/perdin/baru`             |
| My Request              | `/my-request`              |
| My Task                 | `/my-task`                 |
| Task detail             | `/perdin/task/$instanceId` |

## Demo accounts

A migration (`packages/db/src/migrations/*_seed-demo-accounts`) seeds both
accounts, so they exist locally and after every deploy. The login page also has
one-click buttons for them.

| Account     | Email                   | Password                | Golongan | Role        |
| ----------- | ----------------------- | ----------------------- | -------- | ----------- |
| Rina        | `rina@nemu.demo`        | `rina-demo-2026`        | III/a    | pegawai     |
| Verifikator | `verifikator@nemu.demo` | `verifikator-demo-2026` | III/c    | verifikator |

Rina's user id is `rina`, matching the fixtures in `@nemu/contracts/fixtures`.

## nemu_id

Every interactive element carries a `data-nemu-id` and an accessible label
(visible text or `aria-label`). The full list lives in one place:
[`packages/contracts/src/nemu-ids.ts`](../packages/contracts/src/nemu-ids.ts),
grouped by page. Ids are plain strings in that file, so they never change
between builds; `nemu-ids.test.ts` checks that each one satisfies the wire
schema, that none repeats, and that every fixture targets a registered id.

To add an element, register its id in `NEMU_IDS` first and render it with
`data-nemu-id={NEMU_IDS.<page>.<element>}`. Never rename or reuse an id: the
fixtures, the AI, and the extension's Action Level config (ADR-0002) target them.
