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

| Procedure                                       | Input → output                                                                                                                      | PRD         |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| `helpRoute`                                     | transcript → `{kind: "control", control}` or `{kind: "intent", intent: input_nilai \| kenapa \| proses \| tanya \| unknown}`        | F0-06       |
| `gradesParseCommand`                            | "masukkan nilai UTS Matematika 4B" → `{className, subject, assessment}` or one question                                             | F1-05       |
| `inboxUploadPhoto`                              | photo file → `InboxJob` (queued)                                                                                                    | F1-01       |
| `inboxJobs`                                     | → this teacher's jobs, newest first (poll every few seconds while Nemu is open)                                                     | F1-01       |
| `inboxProcess`                                  | `{jobId, className, assessment}` → `InboxJob` with `reading` and `verification` (≤ 60 s)                                            | F1-03/04/06 |
| `inboxPhoto`                                    | `{jobId}` → the photo, for crops                                                                                                    | W5          |
| `inboxAck`                                      | `{jobId}` → deletes the photo and job                                                                                               | §8 privacy  |
| `gradesParseExcel`                              | Excel file + class + assessment → `reading` + `verification`                                                                        | F1-02       |
| `gradesFinalize`                                | `{reading, answers}` → entries with `remedial`, summary, citations; or `needs_source` / `unresolved`                                | F1-06/07    |
| `gradesReadbackAlurSekolah`                     | `{entries, className, subject, assessment, semester?}` → reads `/api/v1/nilai` with the WS-07 key → `{match, mismatches, sentence}` | F1-10       |
| `gradesReadback`                                | `{entries, saved}` (scraped Rekap Nilai rows) → `{match, mismatches, sentence}`; fallback when AlurSekolah isn't connected          | F1-10       |
| `gradesGuidedLine`                              | `{entries, studentId, typed}` → "Ketik 77 untuk Budi." / "Di buku 77, Bu."                                                          | F1-11       |
| `helpExplain`                                   | `{snapshot, question}` → bubble sentence, `why`, `citation`, `fixer`, `waDraft`, `guidedTarget`                                     | F2          |
| `helpAsk`                                       | question → answer with verified citations, or "Belum ada di panduan sekolah."                                                       | F3-04/07    |
| `helpTryAnswer` (admin)                         | `{question, documentIds}` → the `helpAsk` answer as if those inactive documents were active (Uji jawaban)                           | WS-09       |
| `processList`, `processXml`                     | active BPMN processes; the XML for the viewer                                                                                       | F3-03/06    |
| `processPlan`                                   | `{documentId, text, answering, slots, stepIndex}` → one step: `fill` \| `ask` \| `human` \| `done`                                  | F3-09       |
| `procedureCompile` (admin)                      | recorded events + narration → `Procedure` for review                                                                                | F3-01       |
| `procedureSave` (admin)                         | reviewed `Procedure` → knowledge document (activate/deactivate in Documents)                                                        | F3-02/05    |
| `procedureList`, `procedureGet`, `procedureRun` | steps with values filled in; stop at `requiresHumanAction`                                                                          | F3-01       |
| `speechTranscribe`                              | 16 kHz mono audio (base64) → text to show in the bubble                                                                             | F0-04       |
| `speechSynthesize`                              | sentence → audio + word timings, or `audioBase64: ""` (use the local OS voice)                                                      | F0-05       |

`.bpmn` files are accepted by `uploadDocument` and the Admin Workspace picker. On upload each task and end event is stored in `process_element` with an empty symptom list and, for a user task, a page taken from its label; the operator corrects both in WS-04 (`listProcessElements`, `saveProcessElement`). Generating symptoms on upload (F3-11) is #217's and should write into the same rows.

`helpExplain` reads only the WS-05 Kamus Kendala table (`kamus_kendala`, citation `docId: "kamus-kendala"`, `article` = the row's code), not uploaded documents.

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

### F3: processes and recorded procedures

- **BPMN (W9).** `helpRoute` → `proses` with `processName`. Call `processPlan({documentId, text: transcript, answering: null, slots: {}, stepIndex: 0})`.
  - Keep the returned `slots`; call again with `stepIndex + 1`.
  - `ask`: speak `question`, then call with `text` = the answer and `answering` = `step.slot`. An `ask` always comes before any fill.
  - `fill`: fill the field labelled `fields[0].label` with `value`; show `because` behind **Kenapa?**.
  - `human`: point and wait (Ajukan, uploads).
  - `done`: finish.
  - Viewer: `processXml` + highlight `activeTaskId`.
- **Recording (W8).** The extension records `RecordedEvent[]` (locators, never password values). Narration: transcribe each spoken sentence with `speechTranscribe`, with `start/end` in ms from the recording start. Then:
  1. `procedureCompile` → the operator reviews and renames → `procedureSave`.
  2. The teacher: `procedureRun({documentId, values})` → `missing` (ask `parameter.question`) or `steps` with `value` filled in.
  3. Execute until the first `requiresHumanAction` step; that one is the teacher's.

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

| Piece                                  | Where                                                                                                                                                                               | Replace with                                                                                                                                         |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Teacher profile, roster, contacts, KKM | Done: WS-06 in D1 (`createRegistrySchoolDirectory`), seeded from `profil-sekolah.json` and `daftar-siswa-*.csv`; `createDemoSchoolDirectory()` stays for tests                      | Rosters from the AlurSekolah `/siswa` read (#204) once the school's key is set                                                                       |
| SOP Penilaian                          | Seed migration, document `sop-penilaian-sdit-nusantara`                                                                                                                             | Upload the official PDF in Admin → Pengetahuan sekolah. Then re-point the four `school.*` Rule Sources at the new SOP and deactivate the seeded one. |
| Kamus Kendala                          | Seed migrations, rows K-01..K-07 in `kamus_kendala` (K-02 is test F2-3, K-07 is F2-2)                                                                                               | Import the official kamus in Admin → Kamus Kendala (Excel) or type the rows.                                                                         |
| Izin BPMN                              | `packages/ai/src/school/fixtures/pengajuan-izin-guru.bpmn` (tests only)                                                                                                             | Upload `F3-1_pengajuan-izin-guru.bpmn`                                                                                                               |
| F1-1 grade-book photo                  | `packages/ai/src/school/fixtures/f1-1-buku-nilai-4b.jpg`, drawn by `packages/ai/scripts/f1-1-photo.py` for 01_profil-sekolah's 4B, laid out where the offline reader puts its cells | The official F1-1 photo from the test pack                                                                                                           |
| F1 eval truth                          | Synthetic page                                                                                                                                                                      | `pnpm --filter @nemu/ai eval:school -- --live --photo <F1-1 photo> --truth <truth.json>`                                                             |

## Known limits

- No live model call has been made yet (expired key). Prompts and schemas are tested against recorded shapes only.
- Photo jobs are polled, not pushed (ADR-0011).
- With OpenRouter TTS the word highlight is estimated, so it can drift by a few hundred ms (ADR-0012).
