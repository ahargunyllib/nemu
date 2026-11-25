# Nemu school AI: integration guide

> **PRD v2.3 (25 Nov) moved Nemu to a Chrome/Edge extension only.** This guide covers what is built (PR #192) with v2.3 adjustments. The F2-08, any-BPMN, F4 quiz and BPMN-export work still to come is planned in `docs/AI_TECHNICAL_PRD.md` §3–§8.

The AI side of Nemu (AlurSekolah) as built for the MVP. It is for the fullstack side: what to call, in what order, and what you must enforce. The design is in `docs/AI_TECHNICAL_PRD.md`; the decisions are ADR-0009 to ADR-0012.

Everything here runs on the synthetic school **SDIT Nusantara**. Replace the synthetic pieces listed at the end once the official `data-uji-mvp-v2` files are in hand.

## Run it

| Mode    | How                                                             | Models                                                                                                                                           |
| ------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Offline | `NEMU_RESPONDER=fixture` in `apps/server/.env`, then `pnpm dev` | None. Every photo reads as the F1-1-shaped synthetic page, help and answers come from rules. Shapes are real, so the UI can be built against it. |
| Live    | `NEMU_RESPONDER=ai` and a valid `OPENROUTER_API_KEY`            | The `OPENROUTER_SCHOOL_*` models in `apps/server/.env.schema`                                                                                    |

The OpenRouter key in `apps/server/.env` had **expired** on 25 Nov 2026 (HTTP 401), so nothing live was run. Renew it before live testing.

Accounts (seeded by `packages/db/src/migrations/20261125120000_seed_school_workspace`, workspace `W-SEKOLAH`, demo date Tuesday 1 Dec 2026):

| Who                         | Email             | Password          | Role                                                        |
| --------------------------- | ----------------- | ----------------- | ----------------------------------------------------------- |
| Bu Siti (teacher, class 4B) | `siti@nemu.demo`  | `siti-demo-2026`  | `guru`                                                      |
| Pak Rizal (operator)        | `rizal@nemu.demo` | `rizal-demo-2026` | `admin` (can upload documents, compile and save procedures) |

## Procedures

All are oRPC procedures on the Nemu Service, gated to `W-SEKOLAH` sessions. Types are in `@nemu/contracts/school`.

| Procedure                                       | Input → output                                                                                                               | PRD         |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ----------- |
| `helpRoute`                                     | transcript → `{kind: "control", control}` or `{kind: "intent", intent: input_nilai \| kenapa \| proses \| tanya \| unknown}` | F0-06       |
| `gradesParseCommand`                            | "masukkan nilai UTS Matematika 4B" → `{className, subject, assessment}` or one question                                      | F1-05       |
| `inboxUploadPhoto`                              | photo file → `InboxJob` (queued)                                                                                             | F1-01       |
| `inboxJobs`                                     | → this teacher's jobs, newest first (poll every few seconds while Nemu is open)                                              | F1-01       |
| `inboxProcess`                                  | `{jobId, className, assessment}` → `InboxJob` with `reading` and `verification` (≤ 60 s)                                     | F1-03/04/06 |
| `inboxPhoto`                                    | `{jobId}` → the photo, for crops                                                                                             | W5          |
| `inboxAck`                                      | `{jobId}` → deletes the photo and job                                                                                        | §8 privacy  |
| `gradesParseExcel`                              | Excel file + class + assessment → `reading` + `verification`                                                                 | F1-02       |
| `gradesFinalize`                                | `{reading, answers}` → entries with `remedial`, summary, citations; or `needs_source` / `unresolved`                         | F1-06/07    |
| `gradesReadback`                                | `{entries, saved}` (Rekap Nilai rows) → `{match, mismatches, sentence}`                                                      | F1-10       |
| `gradesGuidedLine`                              | `{entries, studentId, typed}` → "Ketik 77 untuk Budi." / "Di buku 77, Bu."                                                   | F1-11       |
| `helpExplain`                                   | `{snapshot, question}` → bubble sentence, `why`, `citation`, `fixer`, `waDraft`, `guidedTarget`                              | F2          |
| `helpAsk`                                       | question → answer with verified citations, or "Belum ada di panduan sekolah."                                                | F3-04/07    |
| `processList`, `processXml`                     | active BPMN processes; the XML for the viewer                                                                                | F3-03/06    |
| `processPlan`                                   | `{documentId, text, answering, slots, stepIndex}` → one step: `fill` \| `ask` \| `human` \| `done`                           | F3-09       |
| `procedureCompile` (admin)                      | recorded events + narration → `Procedure` for review                                                                         | F3-01       |
| `procedureSave` (admin)                         | reviewed `Procedure` → knowledge document (activate/deactivate in Documents)                                                 | F3-02/05    |
| `procedureList`, `procedureGet`, `procedureRun` | steps with values filled in; stop at `requiresHumanAction`                                                                   | F3-01       |
| `speechTranscribe`                              | 16 kHz mono audio (base64) → text to show in the bubble                                                                      | F0-04       |
| `speechSynthesize`                              | sentence → audio + word timings, or `audioBase64: ""` (use the local OS voice)                                               | F0-05       |

`.bpmn` files are now accepted by the existing `uploadDocument` (Admin Workspace → Documents); the admin UI's file picker may need `.bpmn` added to its accept list.

## Flows

### F1: grade book to AlurSekolah

1. `helpRoute` → `input_nilai`, then `gradesParseCommand`. Speak `question` if it returns `ask`.
2. Photo arrives: from the WhatsApp webhook (below) or `inboxUploadPhoto`. Poll `inboxJobs`; when a job is `queued`, call `inboxProcess` with the class and assessment.
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
6. After the save, scrape Rekap Nilai into `{name, value}[]` and call `gradesReadback`; speak `sentence`. Then `inboxAck`.
7. Guided mode (F1-11): for each student `gradesGuidedLine(typed: null)` → speak; on blur `gradesGuidedLine(typed)` → speak if `ok` is false.

### F2: "Nemu, ini kenapa?"

1. When the teacher holds Ctrl+Space, the extension builds a page snapshot (`ScreenSnapshot` in `@nemu/contracts/school`):
   - the page's title and URL, visible error and status texts, and controls with their accessible names and boxes;
   - never input values, and `blocked: true` with no text when a password field is on the page;
   - `screenshotBase64` stays `null`, because v2.3 reads the DOM.
2. `helpExplain({snapshot, question: transcript})`:
   - `matched`: the bubble shows `sentence`; **Kenapa?** shows `why`; **Sumber** opens `citation`.
   - If `canSelfFix`, point at the element in `snapshot.elements` whose `name` is `guidedTarget` (way 2).
   - Else open `https://web.whatsapp.com/send?phone=<waDraft.phone>&text=<waDraft.text>`, text only, no screenshot. **The teacher presses Kirim.**
   - `not_in_guide`: speak `sentence`; offer `waDraft` to the operator.
   - `blocked`: a password is on the page; nothing was sent.
3. Coming in v2.3:
   - matching against the kamus **table** (WS-05) instead of PDF chunks;
   - `explainMissingGrade` for "nilai tidak muncul" (F2-08: API check, BPMN trace, parent reply).

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

## WhatsApp webhook (fullstack side)

Look up the sender **before** downloading the media, and drop unknown numbers (F1-01):

```ts
import { enqueuePhoto, teacherForSender } from "@nemu/api/modules/inbox/service";
import { createDemoSchoolDirectory } from "@nemu/api/modules/school/directory";

// inside the Meta webhook route, after verifying X-Hub-Signature-256:
const teacher = await teacherForSender(directory, message.from);
if (!teacher) return c.body(null, 200); // unknown number: never download
const bytes = await downloadWhatsAppMedia(message.image.id); // your Graph API call (URL expires in 5 min)
await enqueuePhoto(
  { store: inboxStore },
  { teacherId: teacher.teacherId, source: "whatsapp", bytes, messageId: message.id },
);
return c.body(null, 200);
```

The same `messageId` enqueued twice (Meta retries) is one job. Don't reply in WhatsApp: each reply beyond the free tier costs about Rp357.

## What the executor must enforce

The AI never emits a press of Simpan, Kirim, Ajukan or Hapus: those are `human` steps or `requiresHumanAction`. The executor must refuse them independently (F0-08):

- Use `isDeniedActionName(name)` from `@nemu/ai/school/safety` on every target before acting.
- Never call `form.submit()` / `requestSubmit()`, never dispatch Enter.
- Cancel any `submit` event with `isTrusted === false` while Nemu is acting.

## Synthetic pieces to replace

| Piece                                  | Where                                                                                    | Replace with                                                                                                                                                                    |
| -------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Teacher profile, roster, contacts, KKM | `createDemoSchoolDirectory()` in `packages/api/src/modules/school/directory.ts`          | v2.3: teachers and contacts from the workspace (WS-06); roster and KKM from AlurSekolah API v1 (`/siswa`, `/nilai/rekap`); same `SchoolDirectory` port                          |
| SOP Penilaian, Kamus Kendala           | Seed migration, documents `sop-penilaian-sdit-nusantara`, `kamus-kendala-sdit-nusantara` | Upload the official PDFs in Admin → Documents. Then re-point the four `school.*` Rule Sources at the new SOP (Admin → Documents → Rule Sources) and deactivate the seeded ones. |
| Izin BPMN                              | `packages/ai/src/school/fixtures/pengajuan-izin-guru.bpmn` (tests only)                  | v2.3 dropped the leave case; use the SPP and tahfidz BPMN files from Javan when they arrive                                                                                     |
| F1 eval truth                          | Synthetic page                                                                           | `pnpm --filter @nemu/ai eval:school -- --live --photo <F1-1 photo> --truth <truth.json>`                                                                                        |

## Known limits

- No live model call has been made yet (expired key). Prompts and schemas are tested against recorded shapes only.
- Photo jobs are polled, not pushed (ADR-0011).
- With OpenRouter TTS the word highlight is estimated, so it can drift by a few hundred ms (ADR-0012).
- The desktop screen reader (Windows UI Automation, Electron capture) was removed in v2.3; the extension reads the page instead.
