# Nemu

Nemu is an AI guide in the browser that walks an employee through a work process inside their organisation's web app, answering only from knowledge the admin manages. The MVP guides one Perjalanan Dinas on a fake AlurKerja app.

## Products

**Nemu Extension**:
The Chrome extension the employee uses: mascot, composer, area crop, highlight and navigation clicks, active only on allowlisted domains.
_Avoid_: plugin, overlay

**Nemu Service**:
The backend both other Nemu parts talk to: answers chat requests, holds knowledge and tables, enforces action rules.
_Avoid_: layanan, backend, API

**Admin Workspace**:
The web console where an admin manages documents, tables, domains, action rules and user profiles.
_Avoid_: workspace (alone), dashboard

**Demo App**:
Our fake AlurKerja App, the only place Nemu runs in the MVP. It is not the real AlurKerja. Its UI is in Indonesian, so Nemu can quote its labels.
_Avoid_: Tiruan App, AlurKerja App, web app

**AlurKerja tenant**:
An organisation's own instance of the real AlurKerja SaaS. Out of scope for the MVP.
_Avoid_: workspace

## Guiding

**Momen**:
One of the three demo moments in Rina's Perjalanan Dinas: start the request (1), fill the lodging field (2), after returning home (3).
_Avoid_: scenario, step

**Action Level**:
How far Nemu may act on an element: **Jalan sendiri** (Nemu clicks), **Arahkan** (Nemu highlights, user fills), **Konfirmasi** (user presses), **Dilarang** (never).
_Avoid_: permission, mode

**nemu_id**:
The stable identifier the Demo App puts on every interactive element so Nemu can target it.
_Avoid_: selector, element id

**Element List**:
The visible interactive elements the Nemu Extension sends with each prompt; Nemu may only act on elements in it.

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

## Perjalanan Dinas domain

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
One employee's Perjalanan Dinas running in the Demo App, with a single current **State** (Draf → Diajukan → Disetujui → Berangkat → Kembali → Pertanggungjawaban → Verifikasi → Selesai, or Revisi).

**Task**:
The work item a Process Instance currently asks of the employee (e.g. fill the plan, submit Pertanggungjawaban); derived from its State.
