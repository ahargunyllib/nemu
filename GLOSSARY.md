# Nemu

Nemu is an AI companion in the browser that does school administration together with a teacher, on the AlurSekolah, Moodle and government pages she already uses, answering only from knowledge the school and Javan manage. Terms from the first MVP, a guide on a fake AlurKerja app, are under "Legacy" below.

## Products

**Nemu Extension**:
The Chrome and Edge extension the teacher uses: it reads and fills the page in front of her, active only on allowed websites.
_Avoid_: plugin, overlay

**Nemu Service**:
The backend both other Nemu parts talk to: answers chat requests, holds knowledge and tables, enforces action rules.
_Avoid_: layanan, backend, API

**Admin Workspace**:
The web console where Admin Javan and school operators manage knowledge, teachers and settings.
_Avoid_: workspace (alone), dashboard

**Admin Javan**:
The `admin` role: Javan's staff, who see every page and every school in the Admin Workspace.
_Avoid_: superadmin

**Operator**:
The `operator` role: a school's administrator, tied to one school's Knowledge Workspace. Sees only that school's knowledge, Kamus Kendala, Uji jawaban and Teachers & contacts pages. Also the contact teachers are sent to for account and class problems.
_Avoid_: school admin

**Knowledge Workspace**:
The set of knowledge, Reference Tables, process data and users Nemu answers from for one case: `W-SEKOLAH`, or the legacy `W-TRAVEL` and `W-TELKO`. A signed-in user belongs to one, and the Nemu Service reads only that one's data.
_Avoid_: workspace (alone), tenant

**Rule Source**:
The document location (document, article or section, page) that a deterministic rule such as the KKM or an SBM lookup cites. Each rule has a default; an admin can point it at a newer document.
_Avoid_: citation mapping, source binding

## Sekolah domain

**W-SEKOLAH**:
The Knowledge Workspace for Nemu on AlurSekolah: the fictional SDIT Nusantara, with Bu Siti (teacher) and Pak Rizal (operator). See `docs/school-ai.md`.
_Avoid_: school tenant

**Teachers & contacts (WS-06)**:
The school's teacher registry: name, AlurSekolah email, WhatsApp number, classes and subjects, plus one contact per role (operator, kepala sekolah, bagian keuangan). The extension recognises a teacher by the email, the WhatsApp bot by the number. Backs the `SchoolDirectory` port.
_Avoid_: user profiles, guru list

**Photo Job**:
One grade-book photo waiting to be read for a teacher, from WhatsApp or an upload. It lives in the `inbox` bucket until the teacher saves, at most a day.
_Avoid_: upload, ticket

**Verification Question**:
One screen asking the teacher about a doubtful digit, a name spelled differently from the roster, or an S/I/A cell. Its options are never pre-selected.
_Avoid_: confirmation, review

**Kamus Kendala**:
The school's error dictionary: what an error message means, whose fault it is, and who fixes it. Nemu answers "ini kenapa?" only from it.
_Avoid_: FAQ, error list

**Recorded Procedure**:
Steps an operator recorded once ("cara Pak Rizal"), with demo values turned into parameters. Replayed without a model; save, send and submit steps stay the teacher's.
_Avoid_: macro, script

## Legacy: the AlurKerja MVP

These terms describe the first MVP, a guide for an employee on a fake AlurKerja app (the Demo App, now removed). Their code stays until the extension moves onto the school procedures, then leaves with it.

### Guiding

**Momen**:
One of the three demo moments in Rina's Perjalanan Dinas: start the request (1), fill the lodging field (2), after returning home (3).
_Avoid_: scenario, step

**Action Level**:
How far Nemu may act on an element: **Jalan sendiri** (Nemu clicks), **Arahkan** (Nemu highlights, user fills), **Konfirmasi** (user presses), **Dilarang** (never).
_Avoid_: permission, mode

**nemu_id**:
The stable identifier the Demo App put on every interactive element so Nemu can target it.
_Avoid_: selector, element id

**Element List**:
The visible interactive elements the Nemu Extension sends with each prompt; Nemu may only act on elements in it.

**Guide**:
An ordered list of steps (target and label) for one process, returned with an answer, with a one-based `current_step`. It is not executable: only the steps on the current page become actions. The Nemu Service derives it afresh from each request; the Nemu Extension keeps its progress across pages.
_Avoid_: tour, wizard, flow

**Area Crop**:
An image of a viewport region the user drags a box around, sent with the prompt.
_Avoid_: screenshot, blok area

**Answer Card**:
The card that shows Nemu's reply: summary, expandable detail, clickable citations and calculation breakdown.

**Composer**:
The prompt input that opens beside the cursor.
_Avoid_: chat box

**Chat Log**:
The audit record of every chat request (time, user, prompt, sources, actions, result), shown to the admin in the Admin Workspace. It notes whether an Area Crop was attached but never stores the image.
_Avoid_: chat history, transcript

### Perjalanan Dinas domain

**Perjalanan Dinas**:
An official work trip, governed by PMK 113/2012 jo. PMK 119/2023.
_Avoid_: business trip, perdin

**SBM**:
Standar Biaya Masukan, the yearly cost-ceiling table (TA 2026 = PMK 32/2025) that sets daily allowance, lodging and transport rates per province and golongan.

**Kalender Libur**:
The year's national holidays and cuti bersama; days in it are not working days when counting deadlines such as the Pertanggungjawaban.
_Avoid_: holiday list

**Reference Table**:
A structured table the admin uploads as CSV in the Admin Workspace: one of the SBM tables or the Kalender Libur. A new upload replaces the stored table of the same type.
_Avoid_: table (alone), spreadsheet

**Golongan**:
A civil servant's rank (e.g. III/a); it selects the SBM row.

**Pertanggungjawaban**:
The post-trip accountability submission, due within 5 working days after return.
_Avoid_: reimbursement, laporan

**Process Instance**:
One employee's Perjalanan Dinas, with a single current **State** (Draf → Diajukan → Disetujui → Berangkat → Kembali → Pertanggungjawaban → Verifikasi → Selesai, or Revisi).

**Task**:
The work item a Process Instance currently asks of the employee (e.g. fill the plan, submit Pertanggungjawaban); derived from its State.

### Klaim SLA domain

**Klaim SLA**:
A corporate customer's claim for compensation after an internet outage beyond its contracted SLA, reviewed under SOP-KLAIM-SLA-01 and settled as a credit note on the next invoice, never as cash. The second case of the first MVP, in the `W-TELKO` Knowledge Workspace.
_Avoid_: refund, complaint

**Billing Liaison**:
The employee (Dimas) who registers a Klaim SLA, matches its data, reviews its tickets and drafts the Berita Acara. Supervisor Billing and Manajer Billing Operations approve by amount.
_Avoid_: admin, agent

**RCA**:
The root-cause report the NOC completes for an incident ticket. Only an approved RCA can exclude an interval (customer-power or customer-device cause) from the downtime counted for compensation.
_Avoid_: root cause, cause report

**PERLU_BUKTI**:
The result of a Klaim SLA calculation while an RCA is not yet approved: Nemu shows no final amount and asks for the RCA instead.
_Avoid_: pending, unknown
