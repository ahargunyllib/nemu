# Nemu v2.2 school AI: integration guide

The AI side of Nemu v2.2 (AlurSekolah) as built for the MVP. It is for the fullstack side: what to call, in what order, and what you must enforce. The design is in `docs/AI_TECHNICAL_PRD.md`; the decisions are ADR-0009 to ADR-0012.

Everything here runs on the synthetic school **SDIT Nusantara**. Replace the synthetic pieces listed at the end once the official `data-uji-mvp-v2` files are in hand.

## Run it

| Mode    | How                                                             | Models                                                                                                                                                                                                                                      |
| ------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Offline | `NEMU_RESPONDER=fixture` in `apps/server/.env`, then `pnpm dev` | None. Every photo reads as the F1-1-shaped synthetic page written for the named class's roster (4 doubtful digits, 5 names spelled differently, 1 S), help and answers come from rules. Shapes are real, so the UI can be built against it. |
| Live    | `NEMU_RESPONDER=ai` and a valid `OPENROUTER_API_KEY`            | The `OPENROUTER_SCHOOL_*` models in `apps/server/.env.schema`                                                                                                                                                                               |

The OpenRouter key in `apps/server/.env` had **expired** on 25 Nov 2026 (HTTP 401), so nothing live was run. Renew it before live testing.

Accounts (seeded by `packages/db/src/migrations/20261125120000_seed_school_workspace` and `20261126080000_seed_school_directory`, workspace `W-SEKOLAH`, demo date Tuesday 1 Dec 2026):

| Who                             | Email             | Password          | Role                                                            |
| ------------------------------- | ----------------- | ----------------- | --------------------------------------------------------------- |
| Bu Siti (teacher, classes 4A/B) | `siti@nemu.demo`  | `siti-demo-2026`  | `guru`                                                          |
| Pak Rizal (operator)            | `rizal@nemu.demo` | `rizal-demo-2026` | `operator` (uploads documents, saves procedures, manages WS-06) |
| Admin Javan                     | `javan@nemu.demo` | `javan-demo-2026` | `admin` (every page, including the school list)                 |

## Procedures

All are oRPC procedures on the Nemu Service, open to a `W-SEKOLAH` session or to the Nemu Extension with the school's install code and a registered teacher's page email (ADR-0015). Types are in `@nemu/contracts/school`.

| Procedure                                       | Input → output                                                                                                                                                                       | PRD              |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------- |
| `helpRoute`                                     | transcript → `{kind: "control", control}` or `{kind: "intent", intent: input_nilai \| kenapa \| proses \| tanya \| unknown}`                                                         | F0-06            |
| `gradesParseCommand`                            | "masukkan nilai UTS Matematika 4B" → `{className, subject, assessment}` or one question                                                                                              | F1-05            |
| `inboxUploadPhoto`                              | photo file → `InboxJob` (queued)                                                                                                                                                     | F1-01            |
| `inboxJobs`                                     | → this teacher's jobs, newest first (poll every few seconds while Nemu is open)                                                                                                      | F1-01            |
| `inboxProcess`                                  | `{jobId, className, assessment}` → `InboxJob` with `reading` and `verification` (≤ 60 s)                                                                                             | F1-03/04/06      |
| `inboxPhoto`                                    | `{jobId}` → the photo, for crops                                                                                                                                                     | W5               |
| `inboxAck`                                      | `{jobId}` → deletes the photo and job                                                                                                                                                | §8 privacy       |
| `gradesParseExcel`                              | Excel file + class + assessment → `reading` + `verification`                                                                                                                         | F1-02            |
| `gradesFinalize`                                | `{reading, answers}` → entries with `remedial`, summary, citations; or `needs_source` / `unresolved`                                                                                 | F1-06/07         |
| `gradesReadbackAlurSekolah`                     | `{entries, className, subject, assessment, semester?}` → reads `/api/v1/nilai` with the WS-07 key → `{match, mismatches, sentence}`                                                  | F1-10            |
| `gradesReadback`                                | `{entries, saved}` (scraped Rekap Nilai rows) → `{match, mismatches, sentence}`; fallback when AlurSekolah isn't connected                                                           | F1-10            |
| `gradesGuidedLine`                              | `{entries, studentId, typed}` → "Ketik 77 untuk Budi." / "Di buku 77, Bu."                                                                                                           | F1-11            |
| `helpExplain`                                   | `{snapshot, question}` → bubble sentence, `why`, `citation`, `fixer`, `waDraft`, `guidedTarget`; or a BPMN `process` answer                                                          | F2, F2-08        |
| `helpAsk`                                       | question → answer with verified citations, or "Belum ada di panduan sekolah."                                                                                                        | F3-04/07         |
| `helpTryAnswer` (admin)                         | `{question, documentIds}` → the `helpAsk` answer as if those inactive documents were active (Uji jawaban)                                                                            | WS-09            |
| `processList`, `processXml`                     | active BPMN processes; the XML for the viewer                                                                                                                                        | F3-03/06         |
| `processPlan`                                   | `{documentId, text, answering, slots, stepIndex, table?}` → one step (`fill` \| `rows` \| `ask` \| `human` \| `done`), all `steps`, `overview`, `tasks` (with page), `announcements` | F3-09, F3-15..19 |
| `processReadPhoto`                              | `{documentId, jobId, taskId, slots}` → the inbox photo read against the task's fields: `slots`, `table`, `questions`; or `reshoot`                                                   | F3-16            |
| `processMatchFields`                            | `{fields, pageLabels}` → each BPMN form field's label on this page, or null                                                                                                          | F3-17            |
| `procedureRecordingSave`                        | "Rekam cara" from the extension: `{title, events, narration}` → `{recordingId, recordedBy}`, kept for review                                                                         | F3-01            |
| `procedureRecording` (admin)                    | `{recordingId}` → the recording, for the Admin Workspace's Periksa rekaman                                                                                                           | F3-01            |
| `procedureCompile` (admin)                      | recorded events + narration → `Procedure` for review                                                                                                                                 | F3-01            |
| `procedureSave` (admin)                         | reviewed `Procedure` (with `recordedBy`) → knowledge document (activate/deactivate in Documents)                                                                                     | F3-02/05         |
| `procedureExportBpmn` (admin)                   | `{documentId}` → `{fileName, xml}`: BPMN 2.0, one user task per step, laid out with `bpmn-auto-layout`                                                                               | F3-03            |
| `procedureList`, `procedureGet`, `procedureRun` | steps with values filled in; stop at `requiresHumanAction`                                                                                                                           | F3-01            |
| `speechTranscribe`                              | 16 kHz mono audio (base64) → text to show in the bubble                                                                                                                              | F0-04            |
| `speechSynthesize`                              | sentence → audio + word timings, or `audioBase64: ""` (use the local OS voice)                                                                                                       | F0-05            |

`.bpmn` files are accepted by `uploadDocument` and the Admin Workspace picker. On upload each task, end event and triggering event (start, boundary, intermediate catch) is stored in `process_element` with the index `SchoolAi.suggestSymptoms` gives it in one model call (F3-11; empty if the model fails): its symptoms, its `wayBack` (the element whose step ends that symptom, e.g. Unlock for Lock) and its `role` (who at school can help, e.g. "bagian keuangan"); a user task also gets a page taken from its label. The operator corrects them in WS-04 (`listProcessElements`, `saveProcessElement`; the sheet edits symptoms, role and page, `wayBack` through the API).

`helpExplain` first matches the teacher's words to those symptoms (F2-08, below). Otherwise it reads only the WS-05 Kamus Kendala table (`kamus_kendala`, citation `docId: "kamus-kendala"`, `article` = the row's code).

## Flows

### F1: grade book to AlurSekolah

1. `helpRoute` → `input_nilai`, then `gradesParseCommand`. Speak `question` if it returns `ask`.
2. Photo arrives: from WhatsApp (`apps/wa-bot`, below) or `inboxUploadPhoto`. Poll `inboxJobs`; when a job is `queued`, call `inboxProcess` with the class and assessment.
   - `reshoot`: speak `message` ("Fotonya belum terbaca jelas…").
   - `failed`: speak `message`; the error is also in Workers Logs.
3. W5: show `verification.questions` one per screen.
   - `box` is `[x0, y0, x1, y1]` on a 0–1000 scale of the photo: crop it from `inboxPhoto`.
   - Digit options are in ascending order and **must not be pre-selected**. Always offer "Angka lain".
   - Name questions: options plus "Tidak ada di daftar" (answer `"none"`).
   - Absence: "Kosongkan" or a number.
   - Footer: `verification.acceptedSentence`.
4. `gradesFinalize` with `{questionId, answer}` for every question.
   - `ok`: `entries` (one per student: `value`, `status`, `remedial`), `summarySentence` for **Lihat ringkasan**, `citations` (rule key → knowledge chunk id) for **Sumber**.
   - `needs_source`: the SOP isn't active or its Rule Sources aren't pointed at it (see below).
5. Fill AlurSekolah with the extension from `entries` (blank for `S/I/A/blank`; "remedial" note where `remedial`). Point at **Simpan**; the teacher presses it.
6. After the save, call `gradesReadbackAlurSekolah` with the entries, class, subject and assessment; speak `sentence`. Then `inboxAck`.
   - The Nemu Service reads `/api/v1/nilai` (and `/siswa` for the roster) with the key Admin Javan stored in WS-07; the extension never sees it. A student with no stored grade reads as `kosong`; `UH` also matches AlurSekolah's `Harian`.
   - `PRECONDITION_FAILED`: AlurSekolah isn't connected in WS-07 yet; fall back to scraping Rekap Nilai into `{name, value}[]` for `gradesReadback`. `BAD_GATEWAY`: AlurSekolah refused the key or didn't answer; the message says which.
7. Guided mode (F1-11): for each student `gradesGuidedLine(typed: null)` → speak; on blur `gradesGuidedLine(typed)` → speak if `ok` is false.

### F2: "Nemu, ini kenapa?"

The Nemu Extension does this (#205, `apps/extension/features/ini-kenapa`):

1. When the talk combination goes down (or a question is typed), the page script reads the page: title, URL, `role=alert` text, toasts and error messages, headings, and field labels with their visible values (`readPageSnapshot`). With a password field on screen it reads nothing, and "kenapa" answers that it won't read the page; nothing is captured or sent.
2. If `helpRoute` says `kenapa`, the service worker adds a viewport JPEG (`captureVisibleTab`, ≤1280 px) and calls `helpExplain({snapshot, question: transcript})`. Chrome only allows `captureVisibleTab` with `<all_urls>` or an `activeTab` grant (ADR-0004, ADR-0016), so on the known sites the screenshot is `null` today and F2 runs on the page text.
3. The answer:
   - `matched`: the Gelembung Jawab shows `sentence`; **Kenapa?** shows `why`; **Sumber** shows the Kamus Kendala entry.
   - If `canSelfFix`, **Tunjukkan caranya** starts cara 2: the executor points at `guidedTarget`, found by label, role or text. When it isn't on the page, Nemu first points at the menu the kamus sentence (`citation.quote`) names on the way ("buka menu E-Kinerja"). The teacher clicks.
   - Else **Buka WhatsApp ke …** opens `https://web.whatsapp.com/send?phone=…&text=…` from `waDraft`, with no screenshot. **The teacher presses Kirim.**
   - `not_in_guide`: speak `sentence` ("Belum ada di panduan sekolah. …"); **Ya, tanyakan ke …** opens `waDraft` to the operator.

### F2-08: "nilai tidak muncul" from an uploaded BPMN

Nothing in the code knows SPP: the school's uploaded `.bpmn`, its WS-04 index and its WS-06 contacts drive the answer. Test case F2-1 uses the official `packages/ai/src/school/fixtures/F2-1_alur-spp.bpmn` (English labels, two pools, one Parent lane, boundary events) with `F2-1_pertanyaan-dan-kunci.csv`. `pnpm --filter @nemu/ai eval:f2-1` runs the three questions against the key offline, and `-- --live` with the text model from `apps/server/.env`.

1. `helpRoute` sends "kenapa", "kok" and "tidak muncul/tampil" questions to `kenapa` before grade entry, so "nilai Aisyah sudah saya masukkan, tapi kenapa tidak muncul?" is a question.
2. `helpExplain` collects the symptoms of every active, ready BPMN and calls `SchoolAi.matchSymptom` (offline: shared content words; live: the text model picks one or none). It returns the situation asked about and, when the teacher also names what happened first ("kalau bayar tunai"), that element as `via`.
3. On a match, the Nemu Service asks AlurSekolah first (F3-13, `help/grade-check.ts`, the WS-07 key as in the F1 read-back): the student named in the question from `/siswa`, then `/nilai?nis=`. Saved → `certainty: "confirmed"` and "Nilai … sudah tersimpan. Bukan kesalahan Ibu."; no grades → `grades_not_saved` ("Simpan dulu nilainya"); not connected or an error → `"likely"`, and the sentence says "Kemungkinan"; no student named → `"likely"`, and the process is told as a rule ("menurut alur sekolah, … kalau …"), never as a fact about the child.
4. `SchoolAi.explainProcess` walks the file in code (`bpmn/trace.ts`): from `via` (or back from the cause until a trigger event or a merge) through every gateway branch to the cause and its end event, then over to the way back (the index's `wayBack`, else the cause's gateway's other branch that leads straight to a known way back) with its own branch. When `via` has no path to the cause, the teacher is at `via` ("sudah bayar sebagian, kok masih terkunci?" → Update Status: Partially Paid, with Unlock as the comparison). Sumber keeps 2–4 steps: the cause and the way back, then the branch that led to the cause, then the trigger.
5. Who helps: the lane of a task on the walk if it names a WS-06 contact role; otherwise the `role` most elements of the walk have in the WS-04 index ("bagian keuangan" → `keuangan` → Bu Ratna). The official SPP file has only a Parent lane, so the index's role decides it, and the operator can correct it in WS-04.
6. The model only puts the walk into plain Indonesian (the answer, `why`, each step, the parent reply). Code keeps the element ids and the fixer, adds "Yang bisa membantu: …", rejects text with an element id the file doesn't have, and replaces a reply with an amount, "tunggakan"/"menunggak" or without the helper's name by the safe draft. If the phrasing call fails, the code's drafts answer.
7. The answer (`status: "process"`): `sentence`, `why` (Kenapa?), `steps` (Sumber: 2–4 plain steps, each with its element ids), `fixer`, `parentReply`, `process` and `elementId`.
   - The extension shows the steps under Sumber with **Lihat diagram**, a link to the Admin Workspace's `/process-diagram?document=…&element=…&path=…`, where bpmn-js draws the file with the cause outlined (operators are signed in there; `WXT_ADMIN_URL`, default `http://localhost:3002`).
   - **Buka balasan untuk orang tua** opens `https://web.whatsapp.com/send?text=…` with no number, so WhatsApp Web asks which chat. **The teacher presses Kirim.**
8. No symptom matches and the page shows no error (F3-14): the Kamus Kendala answer says "Belum ada di proses sekolah." instead of "Belum ada di panduan sekolah."

### F3: processes and recorded procedures

- **BPMN (W9).** `helpRoute` → `proses` with `processName`. Call `processPlan({documentId, text: transcript, answering: null, slots: {}, stepIndex: 0})`.
  - Keep the returned `slots`; call again with `stepIndex + 1`.
  - `ask`: speak `question`, then call with `text` = the answer and `answering` = `step.slot`. An `ask` always comes before any fill.
  - `fill`: fill the field labelled `fields[0].label` with `value`; show `because` behind **Kenapa?**.
  - `human`: point and wait (Ajukan, uploads).
  - `done`: finish.
  - Viewer: `processXml` + highlight `activeTaskId`.
- **Running a new process (F3-1, #213).** The Nemu Extension does this (`apps/extension/features/process-run`); nothing in the code knows any one process, the uploaded `.bpmn` is the only input.
  1. `helpRoute` → `proses`, then `processPlan` with the teacher's words. The start form's fields (e.g. setoran or ujian) and the gateway variables are asked first; then Nemu shows `overview` (2–6 steps: each teacher task's page, its documentation, the button only the teacher presses, then `announcements`, the other roles' and the system's tasks, F3-18) and waits for **Mulai**.
  2. A task with fields still missing reads the newest queued photo in the teacher's inbox (WhatsApp or upload) with `processReadPhoto`; otherwise Nemu asks for one or for the answer. The model reads the photo against the task's own form fields; code matches names to the WS-06 roster of the class a slot names, and every value it couldn't read and every name it couldn't place becomes a question (Kartu Pilih with the crop). The checked rows go back to `processPlan` as `table`, and its columns become one `rows` step.
  3. Each teacher task's page (`tasks[].page`, F3-19) is the BPMN task link (`camunda:formKey`, or a `halaman`/`page`/`link`/`url` property), else the operator's WS-04 page, else a recording titled like the task, else the page WS-04 took from the label. Without one, or when its first menu isn't on the page, Nemu only explains.
  4. The executor opens the page through the menu path ("Al-Quran › Setoran baru"). After each menu click it fills the single fields that page shows (Kelas before Setoran baru); on the last page it fills the rest, each table row by the row's name and the column's header, and points at the task's button (from the documentation's "lalu menekan …"). `processMatchFields` turns each BPMN field label into the page's label (code first, then the text model for the rest).
  5. After the teacher presses it, Catatan langkah adds the announcements and the photo is deleted (`inboxAck`).
  - Offline (`NEMU_RESPONDER=fixture`) a photo is read from the JSON in its PNG `nemu-fixture` text chunk (`fixtures/form-photo.ts`); a photo without one asks for a new photo.
- **Recording (W8, #214).** "Rekam cara …" (typed or spoken) or the panel's **Rekam cara** link starts the recorder (`apps/extension/features/recorder`). It keeps the operator's clicks (trusted only) and value changes as locators (role, label, text, `#id`), never a password's value and nothing on Nemu's own overlay. While recording, holding the talk combination is narration: transcribed with `speechTranscribe` and kept as `{start, end}` in ms from the recording's start, the same clock as the events. Then:
  1. **Selesai** → `procedureRecordingSave`; **Periksa rekaman** opens the Admin Workspace's `/recording?recording=…`, where the operator (signed in) sees `procedureCompile`'s steps, renames inputs and their questions, deletes steps or records again (**Rekam ulang** opens the recorded page), sets who recorded it, and saves (`procedureSave`). Simpan, Kirim, Hapus steps show "dikerjakan guru".
  2. **Unduh BPMN** (the review page or the procedure's row in Pengetahuan sekolah) → `procedureExportBpmn`.
  3. The teacher names the procedure ("Catat ujian tahfidz untuk Fatih"): `helpRoute` picks the active BPMN or procedure title sharing the most words; `procedureRun` → `missing` (ask `parameter.question`, one at a time) or `steps`. The executor clicks by name, fills by label and points at the teacher's step, with "Rekaman Bu Siti, langkah 11 dari 11" behind Sumber.

### Speech

- `speechTranscribe` before anything else; show `text`.
- `speechSynthesize(sentence)`. With `timing: "estimated"`, scale every `offsetMs` and `durationMs` by `audio.duration * 1000 / estimatedDurationMs` once the audio loads.
- With `audioBase64: ""`, speak `text` with `speechSynthesis` (Windows: Microsoft Andika `id-ID`) at `rate = 0.85` and use the same `words`.

## WhatsApp photos (`apps/wa-bot`)

The Nemu number is linked with whatsmeow in `apps/wa-bot` on the team VPS (ADR-0013), not the Meta webhook. It calls two procedures in `packages/api/src/modules/wa-bot` over the OpenAPI handler, with `Authorization: Bearer <WA_BOT_SECRET>`:

- `POST /api-reference/wa-bot/sender` `{phone}` → `{registered}`, asked **before** downloading the media. Unknown numbers are ignored (F1-01).
- `POST /api-reference/wa-bot/photos`, multipart `phone`, `messageId`, `photo` → `{status: "queued", jobId}` or `{status: "unknown_sender" | "not_an_image" | "too_large"}`. It runs `teacherForSender` again (it reads WS-06 through `context.school.directory`, `createRegistrySchoolDirectory`), then `enqueuePhoto` with `source: "whatsapp"`. The same `messageId` twice is one job.

Deploy and linking the number: `infra/README.md`.

## What the executor must enforce

The AI never emits a press of Simpan, Kirim, Ajukan or Hapus: those are `human` steps or `requiresHumanAction`. The executor must refuse them independently (F0-08). It does so in the Nemu Extension (#202, `apps/extension/features/executor`); turn `fill` / `human` steps and procedure steps into its step list (`@nemu/contracts/executor`):

- Use `isDeniedActionName(name)` from `@nemu/ai/school/safety` on every target before acting.
- Never call `form.submit()` / `requestSubmit()`, never dispatch Enter.
- Cancel any `submit` event with `isTrusted === false` while Nemu is acting.

## Synthetic pieces to replace

| Piece                                   | Where                                                                                                                                                                                                           | Replace with                                                                                                                                         |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Teacher profile, roster, contacts, KKM  | Done: WS-06 in D1 (`createRegistrySchoolDirectory`), seeded from `profil-sekolah.json` and `daftar-siswa-*.csv`; `createDemoSchoolDirectory()` stays for tests                                                  | Rosters from the AlurSekolah `/siswa` read (#204) once the school's key is set                                                                       |
| SOP Penilaian                           | Seed migration, document `sop-penilaian-sdit-nusantara`                                                                                                                                                         | Upload the official PDF in Admin → Pengetahuan sekolah. Then re-point the four `school.*` Rule Sources at the new SOP and deactivate the seeded one. |
| Kamus Kendala                           | Seed migrations, rows K-01..K-07 in `kamus_kendala` (K-02 is test F2-3, K-07 is F2-2)                                                                                                                           | Import the official kamus in Admin → Kamus Kendala (Excel) or type the rows.                                                                         |
| SPP BPMN and F2-1 questions             | Done: the official `03_F2_macet/F2-1_spp/` files in `packages/ai/src/school/fixtures/`; the offline index and phrasing for them in `fixtures/f2-1-spp.ts` (upload the BPMN in Pengetahuan sekolah for the demo) | The real `.bpmn` if Javan sends one (then regenerate the index on upload)                                                                            |
| Izin BPMN                               | `packages/ai/src/school/fixtures/pengajuan-izin-guru.bpmn` (tests only)                                                                                                                                         | Upload `F3-1_pengajuan-izin-guru.bpmn`                                                                                                               |
| Tahfidz BPMN, F3-1 photo and key        | `packages/ai/src/school/fixtures/F3-1_catat-hafalan-tahfidz.bpmn`, `F3-1_foto-buku-setoran-tahfidz-4A.png` (drawn by `packages/ai/scripts/f3-1-photo.py`), `F3-1_kunci.csv`                                     | The official `04_F3_workspace/` files                                                                                                                |
| F3-3 recording, expected steps, replays | `packages/ai/src/school/fixtures/F3-3_rekaman.json`, `F3-3_langkah-yang-diharapkan.json`, `F3-3_putaran-ulang.csv`                                                                                              | The official F3-3 files                                                                                                                              |
| F1-1 grade-book photo                   | `packages/ai/src/school/fixtures/f1-1-buku-nilai-4b.jpg`, drawn by `packages/ai/scripts/f1-1-photo.py` for 01_profil-sekolah's 4B, laid out where the offline reader puts its cells                             | The official F1-1 photo from the test pack                                                                                                           |
| F1 eval truth                           | Synthetic page                                                                                                                                                                                                  | `pnpm --filter @nemu/ai eval:school -- --live --photo <F1-1 photo> --truth <truth.json>`                                                             |

## Known limits

- No live model call has been made yet (expired key). Prompts and schemas are tested against recorded shapes only.
- Photo jobs are polled, not pushed (ADR-0011).
- With OpenRouter TTS the word highlight is estimated, so it can drift by a few hundred ms (ADR-0012).
