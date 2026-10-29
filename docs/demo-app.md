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

## Language

The Demo App's UI is in Indonesian, the language Nemu speaks, so Nemu can quote
the label on the screen ("tekan Selesaikan Tugas"). AlurKerja's English menus
and buttons are translated: Start a Process is **Mulai Proses**, My Tasks is
**Tugas Saya**, Complete Task is **Selesaikan Tugas**. Dates and the calendar
use the `id-ID` locale ("Oktober 2026", "12 Nov"). Terms the client's own
Indonesian documents use as they are stay: Service ID, Invoice, Billing, CRM,
NOC, RCA, Credit Note, and the Billing Operations unit and Billing Liaison
role.

## Pages

| Page                    | Path                       |
| ----------------------- | -------------------------- |
| Login                   | `/login`                   |
| Beranda                 | `/`                        |
| Ajukan Perjalanan Dinas | `/perdin/baru`             |
| Pengajuan Saya          | `/my-request`              |
| Tugas Saya              | `/my-task`                 |
| Task detail             | `/perdin/task/$instanceId` |
| Klaim SLA               | `/sla-claims`              |
| Tugas klaim SLA         | `/sla-claims/$claimId`     |
| CRM Layanan             | `/crm/$serviceId`          |
| Tiket NOC               | `/noc/$serviceId`          |
| Billing                 | `/billing/$invoiceId`      |

The Task detail page of a Pertanggungjawaban is the Pertanggungjawaban task page.

### Shell

Every signed-in page has AlurKerja's dark side menu: a **Mulai Proses** pill
at the top (it opens Ajukan Perjalanan Dinas and keeps the old
`menu-ajukan-perjalanan-dinas` id), then Beranda, Tugas Saya (with the Task
count), Tugas Grup, Pengajuan Saya, Analitik, Data Master, and Proses Bisnis,
and the signed-in user at the bottom (name, jabatan, golongan; it opens the
account menu). Tugas Grup, Analitik, Data Master, and Proses Bisnis are
disabled, because the demo has no such pages, but they keep full strength as in
AlurKerja. The menu items are text only: the Mulai Proses pill has a
blue-green-amber gradient ring and dot, counts are red pills, and menus that
open a submenu in AlurKerja (Pengajuan Saya, Analitik, Data Master, Proses
Bisnis) end in a chevron. The side menu uses the `sidebar` tokens under a
`dark` class, so it stays on the shared theme. The white top bar
reads "Satker Demo · Yogyakarta" on the left and the user's email on the right.

### Beranda

Beranda is where Momen 1 starts. Under "Dasbor saya · <the demo clock's day>"
and "Selamat pagi, Rina." it shows three cards:

- **Proses Favorit**: Perjalanan Dinas, Pengajuan Cuti, and Reimbursement
  in one row, each with its coloured initials and its `favorite-*` id.
  Perjalanan Dinas opens Ajukan Perjalanan Dinas; the other two only say they
  are not in the demo.
- **Tugas berikutnya**: the user's Tasks from `listMyTasks`, each with its
  `task-*` id, and "Lihat semua … tugas" to Tugas Saya. A Task row shows the
  process initials, the Task, the process, and when it is due: "Hari ini", the
  due day ("12 Nov"), or how late it is ("Terlambat 1 hari", in red), counted
  from the demo clock's day. The due date is the task sheet's Tenggat, which the Nemu Service sends with the Task:
  Pertanggungjawaban opens on `tanggalKembali` and falls due on the batas
  pertanggungjawaban, 5 working days later on the AI's own
  `batas_pertanggungjawaban` and holidays; the other Tasks open on the demo
  clock's day and get a week. The Terlambat, Hari ini, Mendatang, and Semua tugas
  chips count the Tasks and filter the list.
- **Kinerja Saya**: static demo figures for the 30 days up to the demo clock's
  day.

### Ajukan Perjalanan Dinas

The page is titled "Mulai Perjalanan Dinas". The form is one card with four
pill tabs, each stacking its fields in one column, and only the open tab's
fields render:

| Tab              | Fields                                                                           |
| ---------------- | -------------------------------------------------------------------------------- |
| 1 Jenis & tujuan | Jenis perjalanan, Kota tujuan (typed), Dasar penugasan (surat tugas), Maksud     |
| 2 Jadwal         | Tanggal berangkat and kembali (date pickers), Lama perjalanan, Moda transportasi |
| 3 Biaya          | Tiket PP, Penginapan (two cards), Nominal penginapan, Uang harian                |
| 4 Dokumen        | Undangan upload                                                                  |

A picked date reads with its weekday ("Selasa, 3 Nov 2026"), and Lama
perjalanan fills itself from the two dates ("3 hari · 2 malam"). Kota
tujuan must name one of the Demo App's cities (`KOTA_TUJUAN`). Moda
transportasi offers only Pesawat and Kendaraan dinas, which fit the
Yogyakarta–Makassar trip. Dasar penugasan
picks one of the user's surat tugas, and its nomor is sent as `nomorSuratTugas`.
Uang harian shows the SBM daily rate times the days for a luar kota trip.

**Mulai Proses** (top right, `button-kirim-pengajuan`) stays disabled until
every field is valid. A field shows its error once touched, and a tab holding an
error shows a red dot, so Rina can find it from any tab.

### Tugas Saya

Tugas Saya is a narrow column: the "Tugas Saya" heading, a **Cari tugas…**
box, a "Tenggat" label, and a compact row per Task (its label over "Perjalanan
Dinas · <task ID>") that lifts to white on hover. Each row keeps its `task-*` id
and opens the Task detail page. The search filters the rows by Task label, Task
ID, or nomor pengajuan in the browser. When there are no Tasks at all, a
"Tidak ada tugas" panel fills the rest of the page beside the column; otherwise
nothing sits beside it.
The Task detail page shows the same column behind its sheet.

### Task detail

A Task opens as the stock shadcn Sheet on the right of Tugas Saya, over a dimmed
backdrop. It mounts already open, so it appears without sliding in. Closing it
(the × with the `link-kembali-my-task` id, a click outside it, or Esc) slides it
out and goes back to Tugas Saya. The Sheet is non-modal, so the page isn't inert and
the Nemu Composer can take focus. The URL stays `/perdin/task/$instanceId`,
which the extension reads.

The sheet's orange header names the process (Perjalanan Dinas and the Task ID),
the Task (or the State while no Task is open, e.g. Verifikasi) with the nomor
pengajuan, and the trip (Tujuan, Berangkat, Kembali). Its colours are App
tokens in the Demo App's `index.css`, not Nemu amber. On a Pertanggungjawaban
it holds **Delegasikan** (disabled; not in the demo) and **Selesaikan Tugas**
(`button-kirim`), which becomes a "Selesai" mark once sent. Of the tabs, only
Formulir has content. Under "Unggah dokumen pertanggungjawaban" each document is a
row: a dashed drop zone ("Seret file atau klik untuk mengunggah") until it is uploaded,
then a green check with its file name. The whole row is the file input and
carries its `upload-*` id. After Selesaikan Tugas the rows stay, read-only.

### Klaim SLA

Dimas's Knowledge Workspace (`W-TELKO`) lists his claim Tasks the way Tugas
Saya lists Rina's: Klaim SLA (`/sla-claims`) is the "Tugas Saya" column with
**Cari tugas…** and a "Tenggat" label, one compact row per Task ("Registrasi Klaim ·
KLM-2610-0007" over "PT Arunika Retail · TN-ENT-002 · Sep 2026"), each with
its `task-klaim-*` id. A Task opens at `/sla-claims/$claimId` as the same stock,
non-modal Sheet beside that column. Its × or Esc closes it and goes back to Klaim
SLA, but a press outside it doesn't: Nemu's Answer Card sits outside the sheet,
and pressing its **Isi** or × must leave the claim open.

The sheet's orange header (the Task sheet's App colours) names the process and
stage ("Klaim Kompensasi SLA · Tahap 1 dari 6"; Surat Penolakan has no stage),
the Task with its claim number, and Klaim diterima, Tenggat telaah, and
Pelaksana. It holds **Delegasikan** (disabled) and **Selesaikan Tugas**
(`button-kirim-klaim`, with a spinner while it advances); on Persetujuan
**Setujui klaim** (`button-setujui-klaim`) takes Selesaikan Tugas's place, and
a finished claim shows "Selesai". The body holds the stage's fields; Credit
Note, the last stage, adds the approved amount and who approved it.

Registrasi Klaim lists its fields in one column. The letter's own fields come
filled in from the claim (Nomor surat pelanggan, the Service ID select, Periode
gangguan, Jam gangguan diklaim pelanggan); Tanggal klaim diterima starts empty
(dd/mm/yyyy) for Nemu's **Isi**, then come Diajukan tepat waktu? (Ya and Tidak
cards) and Surat klaim (PDF). Telaah Tiket Gangguan gives each NOC ticket a
**Dihitung | Dikecualikan** Keputusan (`seg-keputusan-<ticket>`), and
**Gabungkan interval** adds up the tickets marked Dihitung, counting an overlap
once, into Durasi dihitung (A) beside the hours the customer claimed. Susun
Berita Acara shows the Rincian hitung tiles, whose computed terms appear on
**Hitung**, then Nominal usulan (empty for Nemu's Isi, and editable), the Rute
persetujuan, and **Buat draft berita acara**, which fills in TPL-BILL-01 from the
amount. The task never prints the compensation amount itself.

Persetujuan follows the route in MP-BILL-02: up to Rp500.000 Sari Wulandari
(Supervisor Billing) approves; above it Sari, then Hendra Gunawan (Manajer
Billing Operations). From Persetujuan the claim also shows in each approver's
Klaim SLA, and **Setujui klaim** is enabled only for the approver whose turn it
is. Dimas drafted the claim, so it stays disabled for him (SOP Pasal 8 ayat 2).
The last approval moves the Task to Credit Note, which only Dimas completes.

## Process Instances

Mulai Proses on Ajukan Perjalanan Dinas stores a Process Instance in the
`process_instance` table in State Diajukan, numbered `PD-<year>-<NNNN>` by
departure year. Pengajuan Saya lists the signed-in user's instances from the
`listMyProcessInstances` procedure. The States and the form's wire schema live
in `@nemu/contracts/process-instance`.

A Process Instance's active Task comes from its State: Draf asks to fill in the
plan (`isi_rencana`), Revisi to fix the request (`revisi`), and
Pertanggungjawaban to submit the Pertanggungjawaban (`pertanggungjawaban`).
Every other State waits on the atasan, PPK, or bendahara, so it has no Task.
A Task's ID is its code plus the nomor pengajuan, e.g. `PJ-PD-2026-0042`.
Beranda and Tugas Saya list the Tasks from `listMyTasks`.

The Pertanggungjawaban task page asks for four documents (surat tugas, boarding
pass pergi and pulang, laporan perjalanan). Only the file name is stored, in
`process_document`. Selesaikan Tugas needs all four and moves the State to
Verifikasi, then shows the task ID. Sample PDFs to upload are in
`apps/mock-alurkerja/sample-documents/`; the boarding passes are Yogyakarta
(YIA) ↔ Makassar (UPG).

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
back the signed-in user's 3-Momen fixtures and deletes their other requests. It
also puts every Klaim SLA Task back at Registrasi Klaim with no approvals
(`packages/api/src/modules/sla-claims/demo-seed.ts`), whoever presses it.

A page can add a one-click shortcut above Panel demo with
`useDemoPageAction`. On Ajukan Perjalanan Dinas, **Isi formulir demo** fills
every tab with Rina's Makassar trip (3–5 November 2026, surat tugas
ST-090/2026) and attaches a stand-in `undangan-rapat-koordinasi.pdf`. It leaves
Penginapan and Nominal penginapan empty, because in Momen 2 Rina asks Nemu how
to fill them in.

"Today" comes from the signed-in user's Knowledge Workspace and is the same date the AI
uses. `W-TRAVEL` uses 2026-11-06 and `W-TELKO` uses 2026-10-14; Beranda and the
task sheet read it through `getDemoClock`. `NEMU_DEMO_DATE` remains the fallback
when a Knowledge Workspace has no stored configuration.

## 3-Momen fixtures

A migration (`packages/db/src/migrations/*_seed-demo-process-instances`) seeds
Rina's `PD-2026-0042` to Makassar, 3–5 November 2026, in State
Pertanggungjawaban with the surat tugas and boarding pass pergi uploaded, so
the boarding pass pulang and laporan perjalanan are missing (Momen 3). That
migration is already applied, so a change to
`packages/api/src/modules/process-instances/demo-seed.ts` needs a new migration
that updates the seeded rows, such as `*_correct_demo_boarding_pass` (create
one with `pnpm exec drizzle-kit generate --custom --name <name>` in
`packages/db`). `demo-seed.test.ts` replays every migration and checks the
result matches `demo-seed.ts`.

## Demo accounts

Migrations seed the accounts (`*_seed-demo-accounts` for Rina and the
Verifikator, `*_seed_telco_workspace` for Dimas, `*_seed_telco_approvers` for
Sari and Hendra in `packages/db/src/migrations`), so they exist locally and
after every deploy. The login page also has one-click buttons for them.

| Account     | Email                   | Password                | Golongan | Role                       |
| ----------- | ----------------------- | ----------------------- | -------- | -------------------------- |
| Rina        | `rina@nemu.demo`        | `rina-demo-2026`        | III/a    | pegawai                    |
| Verifikator | `verifikator@nemu.demo` | `verifikator-demo-2026` | III/c    | verifikator                |
| Dimas       | `dimas@nemu.demo`       | `dimas-demo-2026`       | –        | billing_liaison            |
| Sari        | `sari@nemu.demo`        | `sari-demo-2026`        | –        | supervisor_billing         |
| Hendra      | `hendra@nemu.demo`      | `hendra-demo-2026`      | –        | manajer_billing_operations |

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
