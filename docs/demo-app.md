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

The Task detail page of a Pertanggungjawaban is the Pertanggungjawaban task page.

### Shell

Every signed-in page has AlurKerja's dark side menu: a **Start a Process** pill
at the top (it opens Ajukan Perjalanan Dinas and keeps the old
`menu-ajukan-perjalanan-dinas` id), then Home, My Tasks (with the Task count),
Group Tasks, My Requests, Analytics, Master Data, and Business Processes, and
the signed-in user at the bottom (name, jabatan, golongan; it opens the account
menu). Group Tasks, Analytics, Master Data, and Business Processes are
disabled, because the demo has no such pages, but they keep full strength as in
AlurKerja. The menu items are text only: the Start a Process pill has a
blue-green-amber gradient ring and dot, counts are red pills, and menus that
open a submenu in AlurKerja (My Requests, Analytics, Master Data, Business
Processes) end in a chevron. The side menu uses the `sidebar` tokens under a
`dark` class, so it stays on the shared theme. The white top bar
reads "Satker Demo · Yogyakarta" on the left and the user's email on the right.

### Beranda

Beranda is where Momen 1 starts. Under "My dashboard · <the demo clock's day>"
and "Good morning, Rina." it shows three cards:

- **Favorite Processes**: Perjalanan Dinas, Pengajuan Cuti, and Reimbursement,
  each with its `favorite-*` id. Perjalanan Dinas opens Ajukan Perjalanan Dinas;
  the other two only say they are not in the demo.
- **Up next**: the user's Tasks from `listMyTasks`, each with its `task-*` id,
  and "View all … tasks" to My Task. The filter chips are static.
- **My Performance**: static demo figures.

### Ajukan Perjalanan Dinas

The page is titled "Start Perjalanan Dinas". The form is one card with four
tabs, and only the open tab's fields render:

| Tab              | Fields                                                                           |
| ---------------- | -------------------------------------------------------------------------------- |
| 1 Jenis & tujuan | Jenis perjalanan, Kota tujuan (typed), Dasar penugasan (surat tugas), Maksud     |
| 2 Jadwal         | Tanggal berangkat and kembali (date pickers), Lama perjalanan, Moda transportasi |
| 3 Biaya          | Tiket PP, Penginapan (two cards), Nominal penginapan, Uang harian                |
| 4 Dokumen        | Undangan upload                                                                  |

Lama perjalanan fills itself from the two dates ("3 hari · 2 malam"). Kota
tujuan must name one of the Demo App's cities (`KOTA_TUJUAN`). Dasar penugasan
picks one of the user's surat tugas, and its nomor is sent as `nomorSuratTugas`.
Uang harian shows the SBM daily rate times the days for a luar kota trip.

**Start Process** (top right, `button-kirim-pengajuan`) stays disabled until
every field is valid. A field shows its error once touched, and a tab holding an
error shows a red dot, so Rina can find it from any tab.

### Task detail

A Task opens as a sheet on the right of My Task, under the top bar: the Task
list stays in view and clickable beside it, so another Task opens in the same
sheet. Closing it (the × with the `link-kembali-my-task` id, or Esc) goes back
to My Task. The URL stays `/perdin/task/$instanceId`, which the extension reads.

The sheet's orange header names the process (Perjalanan Dinas and the Task ID),
the Task (or the State while no Task is open, e.g. Verifikasi) with the nomor
pengajuan, and the trip (Tujuan, Berangkat, Kembali). Its colours are App
tokens in the Demo App's `index.css`, not Nemu amber. On a Pertanggungjawaban
it holds **Delegate** (disabled; not in the demo) and **Complete Task**
(`button-kirim`), which becomes a "Completed" mark once sent. Of the tabs, only
Form has content. Under "Unggah dokumen pertanggungjawaban" each document is a
row: a dashed drop zone ("Drag file or click to upload") until it is uploaded,
then a green check with its file name. The whole row is the file input and
carries its `upload-*` id. After Complete Task the rows stay, read-only.

## Process Instances

Start Process on Ajukan Perjalanan Dinas stores a Process Instance in the
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
`process_document`. Complete Task needs all four and moves the State to
Verifikasi, then shows the task ID. Sample PDFs to upload are in
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
menu (which leaves room for them under the signed-in user), so the extension's
panel and highlights keep the content area.

**Panel demo** plays the atasan, PPK, and bendahara: pick a
Process Instance and press **Majukan State** to move it to the next State
(Draf → … → Selesai; Revisi goes back to Diajukan). **Reset data demo** puts
back the signed-in user's 3-Momen fixtures and deletes their other requests.

A page can add a one-click shortcut above Panel demo with
`useDemoPageAction`. On Ajukan Perjalanan Dinas, **Isi formulir demo** fills
every tab with Rina's Makassar trip (3–5 November 2026, surat tugas
ST-090/2026) and attaches a stand-in `undangan-rapat-koordinasi.pdf`. It leaves
Penginapan and Nominal penginapan empty, because in Momen 2 Rina asks Nemu how
to fill them in.

"Today" is the demo clock, `NEMU_DEMO_DATE` (2026-11-06), the same setting the
AI counts from; Beranda shows it through `getDemoClock`.

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

Put the id on the whole control Rina sees. A field with a prefix or suffix, such
as `RupiahInput`'s "Rp", carries it on its input group, named by the field label
through `aria-labelledby`, so a highlight rings the prefix too.
