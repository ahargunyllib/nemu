# Demo App

The Demo App (`apps/mock-alurkerja`) is our fake AlurKerja. It carries no Javan or
AlurKerja logos.

## Look

The real AlurKerja App (`app.alurkerja.com`) is built on shadcn with the
`base-maia` style and the `neutral` base color, Figtree for body text, and
Outfit for headings. The shared theme in `packages/ui/src/styles/globals.css`
copies those tokens, so the Demo App, Admin Workspace, and Nemu Extension use
the same palette and fonts. The vendored components in `packages/ui` use the
same `base-maia` style, so buttons and inputs are pill-shaped and cards are
rounded, as in AlurKerja.

## Pages

| Page                    | Path                       |
| ----------------------- | -------------------------- |
| Login                   | `/login`                   |
| Beranda                 | `/`                        |
| Ajukan Perjalanan Dinas | `/perdin/baru`             |
| My Request              | `/my-request`              |
| My Task                 | `/my-task`                 |
| Task detail             | `/perdin/task/$instanceId` |
| Klaim SLA               | `/sla-claims`              |
| Task klaim SLA          | `/sla-claims/$claimId`     |
| CRM Layanan             | `/crm/$serviceId`          |
| Tiket NOC               | `/noc/$serviceId`          |
| Billing                 | `/billing/$invoiceId`      |

The Task detail page of a Pertanggungjawaban is the Pertanggungjawaban task page.

## Process Instances

Kirim on Ajukan Perjalanan Dinas stores a Process Instance in the
`process_instance` table in State Diajukan, numbered `PD-<year>-<NNNN>` by
departure year. My Request lists the signed-in user's instances from the
`listMyProcessInstances` procedure. The States and the form's wire schema live
in `@nemu/contracts/process-instance`.

A Process Instance's active Task comes from its State: Draf asks to fill in the
plan (`isi_rencana`), Revisi to fix the request (`revisi`), and
Pertanggungjawaban to submit the Pertanggungjawaban (`pertanggungjawaban`).
Every other State waits on the atasan, PPK, or bendahara, so it has no Task.
A Task's ID is its code plus the nomor pengajuan, e.g. `PJ-PD-2026-0042`.
Beranda and My Task list the Tasks from `listMyTasks`.

The Pertanggungjawaban task page asks for four documents (surat tugas, boarding
pass pergi and pulang, laporan perjalanan). Only the file name is stored, in
`process_document`. Kirim needs all four and moves the State to Verifikasi,
then shows the task ID. Sample PDFs to upload are in
`apps/mock-alurkerja/sample-documents/`.

## Process endpoints

`listMyTasks` and `getProcessInstance` return the active Task, tanggal kembali,
and uploaded documents of the signed-in user's instances. Before calling the
Responder, `nemuChat` loads the user's active Process Instance (the most
recently changed one with a Task, else the most recently changed one) and sends
it as `process_context`, with document names as the AI reads them
(`surat_tugas`, `boarding_pass_pergi`, `boarding_pass_pulang`,
`laporan_perjalanan`). The extension never sends `process_context`.

The page URL the extension sends picks the stage. On Ajukan Perjalanan Dinas
(`/perdin/baru`, Momen 2) Rina is still planning that trip, so `nemuChat` sends
it as a plan in progress: `active_task` `isi_rencana`, the destination
province and nights (for the lodging calculation), and no State, return date,
or documents. On every other page (Beranda in Momen 1 and 3, the task page) it
sends the instance as it is, so Momen 3 gets Pertanggungjawaban, return date
5 November, and the 12 November deadline.

## Demo panel and demo clock

The demo controls stay out of the AlurKerja header. They float as separate
buttons at the bottom left of every signed-in page, over the end of the side
menu, so the extension's panel and highlights keep the content area.

**Panel demo** plays the atasan, PPK, and bendahara: pick a
Process Instance and press **Majukan State** to move it to the next State
(Draf → … → Selesai; Revisi goes back to Diajukan). **Reset data demo** puts
back the signed-in user's 3-Momen fixtures and deletes their other requests.

A page can add a one-click shortcut above Panel demo with
`useDemoPageAction`. On Ajukan Perjalanan Dinas, **Isi formulir demo** fills
Rina's Makassar trip (3–5 November 2026) and attaches a stand-in
`undangan-rapat-koordinasi.pdf`. It leaves Penginapan and Nominal penginapan
empty, because in Momen 2 Rina asks Nemu how to fill them in.

"Today" comes from the signed-in user's workspace and is the same date the AI
uses. `W-TRAVEL` uses 2026-11-06 and `W-TELKO` uses 2026-10-14; the header shows
it through `getDemoClock`. `NEMU_DEMO_DATE` remains the fallback when a workspace
has no stored configuration.

## 3-Momen fixtures

A migration (`packages/db/src/migrations/*_seed-demo-process-instances`) seeds
Rina's `PD-2026-0042` to Makassar, 3–5 November 2026, in State
Pertanggungjawaban with the surat tugas and boarding pass pergi uploaded, so
the boarding pass pulang and laporan perjalanan are missing (Momen 3). The
migration is generated from `packages/api/src/modules/process-instances/demo-seed.ts`;
after changing it, run `UPDATE_DEMO_SEED=1 pnpm test`.

## Demo accounts

A migration (`packages/db/src/migrations/*_seed-demo-accounts`) seeds both
accounts, so they exist locally and after every deploy. The login page also has
one-click buttons for them.

| Account     | Email                   | Password                | Golongan | Role            |
| ----------- | ----------------------- | ----------------------- | -------- | --------------- |
| Rina        | `rina@nemu.demo`        | `rina-demo-2026`        | III/a    | pegawai         |
| Verifikator | `verifikator@nemu.demo` | `verifikator-demo-2026` | III/c    | verifikator     |
| Dimas       | `dimas@nemu.demo`       | `dimas-demo-2026`       | –        | billing_liaison |

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

Put the id on the whole control Rina sees. A field with a prefix or suffix, such
as `RupiahInput`'s "Rp", carries it on its input group, named by the field label
through `aria-labelledby`, so a highlight rings the prefix too.
