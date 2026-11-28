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
A site on the school's list where the Nemu button appears and Nemu may read the page, such as `*.alursekolah.id`. Everywhere else Nemu shows and reads nothing (ADR-0016). Each site carries a **Site permission**.
_Avoid_: whitelist, allowlist (in UI copy)

**Site permission**:
What Nemu may do on an allowed website: _baca dan isi_ (read and fill fields), _siapkan pesan_ (prepare a message the teacher sends herself) or _baca saja_ (only read and point). Where two sites cover a page, the narrower one wins. The extension reads it with the WS-03 list, so a change needs no update.
_Avoid_: action level, scope

**Nemu settings (WS-08)**:
How Nemu works for every teacher of one school: the talk combination (default Ctrl + Space), the default cara, and the fill speed of cara 1. Delivered to the extension with the WS-03 list.
_Avoid_: preferences, config

**Nemu button**:
The dark orange round button at the bottom right of an allowed website. Clicking it opens the type box; holding Ctrl + Spasi talks to Nemu instead.
_Avoid_: launcher, FAB, mascot

**Display type**:
One of the five fixed shapes everything Nemu shows takes (PRD §6.2): Gelembung Kerja, Gelembung Tunjuk, Gelembung Jawab, Kartu Pilih, Kartu Info. Only one shows at a time.
_Avoid_: popup, modal, widget

**Gelembung Kerja**:
The bubble while Nemu works: a status header with a progress bar ("Nemu mengisi · 13 dari 32"), one sentence, and always Pelan and Berhenti.
_Avoid_: progress toast

**Gelembung Tunjuk**:
The bubble for the teacher's turn: one sentence beside the field or button the Nemu cursor points at, no buttons, at most one link.
_Avoid_: tooltip, hint

**Gelembung Jawab**:
The answer bubble: Nemu's sentence with the Kenapa?, Sumber and Lihat ringkasan links and at most one action button, or why Nemu can't help yet. Above the Nemu button when it is about no page element.
_Avoid_: answer card, chat bubble, toast

**Kartu Pilih**:
The card for a decision: one question and two or three equal big buttons, nothing pre-selected; a risky choice carries ⚠ and sits under the safe one.
_Avoid_: dialog, confirm, prompt

**Kartu Info**:
The card for something to read, such as the Catatan langkah: a title, a short list and one Tutup.
_Avoid_: modal, summary dialog

**Nemu cursor**:
The small dark orange dot that glides (about 0.6 s) to the next page element, rings it, and only then lets the bubble speak (F0-16). Clicks go through it.
_Avoid_: pointer, mascot cursor

**Executor**:
The part of the Nemu Extension that does a task on the page: one step list (point, isi, pilih, centang, gulir, klik menu), run in one of the three cara, with the safety rules enforced in the extension itself (#202).
_Avoid_: bot, macro, automation

**Cara**:
How Nemu and the teacher share a task. Cara 1: Nemu fills and stops before Simpan. Cara 2: Nemu points and says the value, the teacher types, Nemu checks. Cara 3: the teacher works alone and Nemu checks after Simpan.
_Avoid_: mode, level

**Catatan langkah**:
The Kartu Info at the end of each task listing what was done and by whom; reopenable from the Nemu button, with "Coba sendiri" to start in cara 2 next time.
_Avoid_: summary, log

**Action log (WS-10)**:
One row per executor action: who, when, website, action, target and result, never the value typed.
_Avoid_: audit trail, chat log

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

**Integrations (WS-07)**:
Admin Javan's page for a school's integration settings: the AlurSekolah API base URL and key, the Moodle URL and token, and the Nemu WhatsApp number. Values are stored encrypted and never shown again, only "terpasang · …last 4" (ADR-0014). The AlurSekolah base URL decides whether Nemu reads the mock or the school's real tenant.
_Avoid_: credentials page, API settings

**Photo Job**:
One grade-book photo waiting to be read for a teacher, from WhatsApp or an upload. It lives in the `inbox` bucket until the teacher saves, at most a day.
_Avoid_: upload, ticket

**Verification Question**:
One screen asking the teacher about a doubtful digit, a name spelled differently from the roster, or an S/I/A cell. Its options are never pre-selected.
_Avoid_: confirmation, review

**Naskah soal**:
The teacher's own question script (PDF, Word or photo) that Nemu turns into a Moodle quiz (F4-03). Nemu copies its words, choices, key and pictures; anything it can't read becomes a Verification Question, never a guess.
_Avoid_: question bank, quiz file

**Kamus Kendala**:
The school's error dictionary (WS-05): what an error message means, whose fault it is, and who fixes it, one row per message, typed or imported from Excel. Nemu answers "ini kenapa?" only from it, never from uploaded documents.
_Avoid_: FAQ, error list

**Uji jawaban (WS-09)**:
Asking a question in the Admin Workspace and seeing the answer and sources Nemu would give if chosen inactive documents were active. It runs the same answering as the teacher's question, so activating the document changes nothing about the answer.
_Avoid_: preview, sandbox

**Pertanyaan guru**:
A question a teacher asks Nemu: a `tanya` question to the school's guides (F3) or "ini kenapa?" on a page (F2). The Admin Workspace counts this week's, and the unanswered ones ("belum terjawab", when Nemu said it isn't in the guide), but never keeps the words (ADR-0022).
_Avoid_: chat log, query

**Paket AlurSekolah (WS-02)**:
Javan's built-in knowledge on how AlurSekolah works. With "berlaku untuk semua sekolah", its active documents answer every school, not only Javan's own.
_Avoid_: global knowledge, template

**Task page**:
The menu path a BPMN teacher task is done on ("Al-Quran › Setoran baru"): the task's own link in the BPMN, else the operator's WS-04 page, else a recording of the task. Without one Nemu only explains the steps (ADR-0017).
_Avoid_: route, URL

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
