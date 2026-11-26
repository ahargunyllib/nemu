# Nemu

Nemu is an AI companion in the browser that does school administration together with a teacher, on the AlurSekolah, Moodle and government pages she already uses, answering only from knowledge the school and Javan manage. The few terms left from the first MVP, a guide on a fake AlurKerja app, are under "Legacy" below.

## Products

**Nemu Extension**:
The Chrome and Edge extension the teacher uses: it reads and fills the page in front of her, active only on allowed websites.
_Avoid_: plugin, overlay

**Nemu Service**:
The backend both other Nemu parts talk to: answers the teacher's questions, holds knowledge, teachers and tables, and tells the extension where it may run.
_Avoid_: layanan, backend, API

**Install code**:
The code (kode pemasangan) a school operator types into the Nemu Extension's settings once. It tells the Nemu Service which school a request comes from; without a known one the service refuses it (ADR-0015).
_Avoid_: license key, token, API key

**Allowed website (WS-03)**:
A site on the school's list where the Nemu button appears and Nemu may read the page, such as `*.alursekolah.id`. Everywhere else Nemu shows and reads nothing (ADR-0016).
_Avoid_: whitelist, allowlist (in UI copy)

**Nemu button**:
The dark orange round button at the bottom right of an allowed website. Clicking it opens the type box; holding Ctrl + Spasi talks to Nemu instead.
_Avoid_: launcher, FAB, mascot

**Gelembung Jawab**:
The answer bubble above the Nemu button: Nemu's sentence and its sources, or why Nemu can't help yet.
_Avoid_: answer card, chat bubble, toast

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

The first MVP guided an employee through a Perjalanan Dinas on a fake AlurKerja app. Its chat, workflows and extension were removed in #199; these terms remain because the reference tables they name are still in the Admin Workspace.

**Perjalanan Dinas**:
An official work trip, governed by PMK 113/2012 jo. PMK 119/2023.
_Avoid_: business trip, perdin

**SBM**:
Standar Biaya Masukan, the yearly cost-ceiling table (TA 2026 = PMK 32/2025) that sets daily allowance, lodging and transport rates per province and golongan.

**Kalender Libur**:
The year's national holidays and cuti bersama; days in it are not working days when counting deadlines.
_Avoid_: holiday list

**Reference Table**:
A structured table the admin uploads as CSV in the Admin Workspace: one of the SBM tables or the Kalender Libur. A new upload replaces the stored table of the same type.
_Avoid_: table (alone), spreadsheet

**Golongan**:
A civil servant's rank (e.g. III/a); it selects the SBM row.
