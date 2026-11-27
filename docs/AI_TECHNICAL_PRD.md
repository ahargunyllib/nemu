# Technical PRD: Nemu v2.3 MVP, AI scope

Status: draft, 25 November 2026; status table updated 27 November. It answers _how_ to build the **AI parts** of PRD Nemu v2.3 (the product PRD owns _what_; its section 0 lists what changed from v2.2). Deadline: MVP working Friday 27 November 2026, night; pitch and demo 1 December.

**Scope.** We follow the same split as before: AI owns AI features as a vertical slice, as with `chat`, `documents` and `rule-sources`.

**Ours (AI, Zahra):**

- AI pipelines in `packages/ai`, shared types in `packages/contracts`, evals.
- The `packages/api` modules that serve them, including the read-only AlurSekolah API client the AI checks use (F1-10, F2-08, F3-13).
- The photo job pipeline.
- The BPMN layer: understanding any BPMN, tracing symptoms, running a process, and exporting recordings as BPMN.
- AI requirements: F0-04, F0-10 to F0-12, F0-14 (step notes), F1-03 to F1-07, F1-10, F2-02, F2-03, F2-06 to F2-08, F3-03, F3-04, F3-07, F3-10 to F3-17, F4-01, F4-03, and the AI half of F3-01 and WS-09.

**Our fullstack partner's (SE, Billy):**

- The Chrome/Edge extension: the cursor, bubbles and cards, hold Ctrl+Space, the DOM executor, and the three ways of working.
- The workspace web pages (WS-01 to WS-10).
- The WhatsApp bot (whatsmeow on the team VPS, ADR-0013) and the WhatsApp Web hand-off.
- The Moodle test instance.
- Identity (ID-01 to ID-04).

The contract between us is §3. Appendix A holds handoff notes for the partner. **They are not our tasks.**

Research behind this document was done on 25 November 2026 against live sources (OpenRouter, vendor docs, npm, the public AlurSekolah OpenAPI spec). Prices and model IDs move weekly. **(verify)** marks anything not confirmed from a primary source.

---

## 1. What v2.3 changes for the AI side

| Area           | v2.2 plan (PR #192)                               | v2.3                                                                                                                   | Effect on AI work                                                                     |
| -------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Product        | Windows app, UI Automation, desktop screen reader | **Chrome/Edge extension only**, filling through the DOM                                                                | Desktop screen reader removed. The page snapshot comes from the extension's DOM read. |
| Order          | F1 first                                          | **F2 → F1 → F4 → F3**                                                                                                  | Build F2-08 and BPMN tracing first                                                    |
| F2             | Kamus as PDF chunks, 6 cases                      | **Kamus as a table** (WS-05). Three cases: grades not appearing (BPMN SPP), AlurSekolah error, government portal error | Match against structured entries; add F2-08                                           |
| F1             | Photo + Excel                                     | Photo only (Excel cut); roster and read-back from **API v1**                                                           | Excel parser dormant; roster, KKM and read-back come from the API                     |
| F4             | –                                                 | **Moodle quiz**: check as students see it, install from the teacher's script                                           | New: quiz checks, script → Moodle XML                                                 |
| BPMN           | One synthetic leave process                       | **Any BPMN**: symptoms, cause paths, running it step by step, recording → BPMN XML                                     | Main new AI work (Javan's "Kebenaran BPMN" criterion)                                 |
| Talking        | F8 tap + voice-activity detection                 | **Hold Ctrl+Space**, release to finish; same keys for "pelan", "ulangi", "ajari saya" while working                    | Simpler: no end-of-speech detection; add "pelan"                                      |
| Teaching       | Guided mode                                       | **Three ways of working** + **step notes** after every task                                                            | Lines for all three ways; generate step notes                                         |
| WhatsApp draft | Text + screenshot                                 | **Text only** in WhatsApp Web                                                                                          | Drop the screenshot                                                                   |
| Workspace      | Operator uploads                                  | **Javan admin** + school operator; answer testing before activation (WS-09)                                            | Grounded answers reused for WS-09                                                     |

---

## 2. Decisions needed (AI-relevant)

| #   | Decision                                        | Default                                                                                                        | Why it matters                                                        |
| --- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| D1  | Strict zero data retention for children's data? | Allow Safety Retention for the synthetic-data MVP; record it in the DPIA                                       | Gemini on OpenRouter is unavailable under strict ZDR since 2026-10-18 |
| D2  | Cost cap per month or per semester              | Per-semester average                                                                                           | Grade entry bunches at semester end                                   |
| D3  | Paid providers                                  | OpenRouter only: vision, text, speech-to-text, TTS. Azure Speech is an optional upgrade.                       | AGENTS.md: wire a provider only once chosen                           |
| D4  | The SPP key scope                               | Ask Javan whether the read key may include `keuangan/spp`. Without it, F2-08 says "kemungkinan" about payment. | F2-08 accuracy                                                        |

---

## 3. Boundary with the fullstack side

### 3.1 What AI delivers

As of 27 November 2026, the extension work (#223 to #242) has built every flow end to end behind the `SchoolAi` seam, with fixture responders and synthetic test data. What remains for AI is the real model work and the switch to the official test pack. Status:

- ✅ real and tested;
- 🧩 the seam, the procedure and a fixture are on `main`, but the real model or the official data is still open (issue in brackets);
- 🆕 not started.

Pure functions live in `packages/ai`; procedures in `packages/api`.

| Function / procedure                                                                        | Requirement                | Status     |
| ------------------------------------------------------------------------------------------- | -------------------------- | ---------- |
| `readGradePhoto`, `matchNames`, `buildVerificationPlan`, `applyAnswers`, `applySchoolRules` | F1-03 to F1-07             | ✅         |
| Roster, KKM and read-back from API v1 (`/siswa`, `/nilai/rekap`, `/nilai`)                  | F1-04, F1-07, F1-10        | ✅ (#228)  |
| `explainError`: kamus table (WS-05) + page snapshot from the extension                      | F2-02, F2-03, F2-06, F2-07 | 🧩 (#216)  |
| `suggestSymptoms`, `matchSymptom`, `explainProcess` + grade check: F2-08 on any BPMN        | F2-08, F3-11 to F3-14      | 🧩 (#217)  |
| `answerGrounded` with verified citations                                                    | F3-04, F3-07, WS-09        | ✅         |
| `readFormPhoto`, `matchFields`, `planBpmnStep`: run a new BPMN (tahfidz)                    | F3-15 to F3-19             | 🧩 (#220)  |
| `compileProcedure`, procedure → BPMN XML                                                    | F3-01, F3-03               | ✅ (#239)  |
| Nemu's own F1 and F4 flows as `.bpmn` files                                                 | F3-09                      | 🆕 (#215)  |
| `judgeQuiz`: quiz checks that need a model, if any                                          | F4-01                      | 🧩 (#218)  |
| `readQuizScript` → Moodle XML: no question generation; unreadable parts asked               | F4-03                      | 🧩 (#219)  |
| `routeCommand`, `matchVoiceControl` + Javanese-mixed commands                               | F0-04, F0-15               | 🧩 (#222)  |
| `transcribe`, `synthesize`                                                                  | F0-03, F0-05               | ✅         |
| Step notes after a task                                                                     | F0-14                      | 🆕         |
| Desktop screen reader (UIA, Electron)                                                       | –                          | ❌ removed |
| Excel parsing                                                                               | F1-2 cut                   | dormant    |

**The official test pack** (`00_BACA-DULU.md` and its folders) is now available. The fixtures on `main` are synthetic stand-ins and differ from it. For example, the official `F2-1_alur-spp.bpmn` has a DOKU payment pool, partial payment and a "Paid in Cash" boundary event, and its three questions are different. Every 🧩 row is done only when its case passes on the official files.

### 3.2 What AI needs from the fullstack side

| Need                                                                                                                                                                                                                                         | For              |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| **Page snapshot** from the extension when Nemu is called: URL, title, visible error/status texts, form labels with element roles and boxes; never input values; nothing when a password field is present (the `PageSnapshot` contract, #216) | F2, F3-16, F4-01 |
| **Quiz preview snapshot**: per question its text, images (`src`, loaded or broken), referenced figure labels ("(3)"), answer options; plus quiz settings (course, section, open/close)                                                       | F4-01            |
| **Actions log** of a finished task (menu names clicked, fields filled)                                                                                                                                                                       | F0-14 step notes |
| The WhatsApp bot (whatsmeow, ADR-0013) calls `enqueuePhoto` after `teacherForSender`                                                                                                                                                         | F1-01            |
| Teacher and contacts from the workspace (WS-06), kamus rows (WS-05), allowed sites (WS-03)                                                                                                                                                   | F2, identity     |
| An executor that refuses denied buttons (`isDeniedActionName`) and never submits                                                                                                                                                             | F0-08            |

### 3.3 AlurSekolah API v1 (read only, from the public OpenAPI spec)

Bearer key `as_…`, kept on the Nemu Service, never in the extension.

| Endpoint                                            | Used for                                                                 |
| --------------------------------------------------- | ------------------------------------------------------------------------ |
| `GET /api/v1/akademik/guru/saya`                    | The teacher's classes and subjects (F1-05)                               |
| `GET /api/v1/siswa?kelas=`                          | Roster for name matching (F1-04). The roster stays out of model prompts. |
| `GET /api/v1/nilai/rekap?kelas=&mapel=`             | The school's `kkm` (F1-07); class summary                                |
| `GET /api/v1/nilai?kelas=&mapel=&jenis=`            | Read-back after Simpan (F1-10): `nis`, `skor`, `jenis`, `topik` per row  |
| `GET /api/v1/nilai/terbaru/{nis}`                   | "Is the grade saved?" for F2-08                                          |
| `GET /api/v1/hafalan/setoran`, `/hafalan/referensi` | Tahfidz read-back and the surah/ayat reference (F3-1)                    |
| `GET /api/v1/keuangan/spp/rekap`                    | **Outside the requested key scope** (D4)                                 |

Writes such as `POST /nilai/kelas` exist but **are not used**: the teacher saves through the page (PRD §8).

---

## 4. Build order (AI)

| #   | Work                                                                                                         | Test case           |
| --- | ------------------------------------------------------------------------------------------------------------ | ------------------- |
| 1   | **F2:** kamus table matching; page snapshot from the DOM; text-only WhatsApp draft                           | F2-2, F2-3          |
| 2   | **F2-08 + F3-10 to F3-14:** any-BPMN import, symptom index, cause and reverse trace, API check, parent reply | F2-1 (3/3)          |
| 3   | **F1 on v2.3:** API roster and KKM, read-back via `GET /nilai`, lines for ways 1 and 2, step notes           | F1-1, F1-2 (way 2)  |
| 4   | **F4-01** quiz check; **F4-03** script → Moodle XML                                                          | F4-1, F4-2          |
| 5   | **F3-15 to F3-19** run a BPMN (tahfidz), generalized table photo reading                                     | F3-1                |
| 6   | **F3-03, F3-09** BPMN export of recordings and of Nemu's own flows; may run in parallel from the start       | F3-3, Javan minimum |
| 7   | Speech: Javanese-mixed test set; "pelan" control                                                             | F0-2 (≥ 8/10)       |

---

## 5. F2: help when stuck (priority 1)

### 5.1 Errors (F2-02 to F2-07)

1. **Input:** the extension's page snapshot (§3.2) plus the teacher's sentence. No screenshot by default; the DOM gives exact strings.
2. **Match the kamus table** (WS-05: message pattern, meaning, fixing role, can-self-fix, target button):
   - **Deterministic first:** normalized substring or token overlap against each row's message. Cheap and exact for AlurSekolah's fixed messages.
   - **Model only when no row matches strongly:** one call with the snapshot and the top candidate rows, returning a row id or `not_in_guide`.
   - The fixer's name and number come from WS-06; the NIP is added by code.
3. **Output:**
   - Bubble: "Bukan kesalahan Ibu. Yang bisa membantu: Pak Rizal." **Kenapa?** shows the meaning; **Sumber** shows the kamus row.
   - **Can self-fix** (F2-3, "Sinkro Ruang GTK"): `guidedTarget` is the button's accessible name, and the extension points at it (way 2). No WhatsApp.
   - **Needs someone else** (F2-2): `waDraft` is text only (problem, page, what's needed). The teacher presses Kirim in WhatsApp Web.
   - **No row matches:** "Belum ada di panduan sekolah." plus an offer to the operator (F2-06).
4. **Guards:**
   - Page text is data, not instructions (F0-12).
   - Never ask for a password or OTP (F2-07; validator).
   - No sentence says "salah".

### 5.2 Grades not appearing (F2-08, built on F3-10 to F3-14)

Example: a parent asks on WhatsApp "nilai UTS Aisyah kok belum muncul?" and the teacher asks Nemu.

1. **Check the data first (F3-13):** `GET /nilai/terbaru/{nis}` (or `/nilai?nis=`). If the grade is not saved, the answer is "belum tersimpan" and the trace stops.
2. **Find the cause in the BPMN (F3-12):**
   - Look up the symptom "nilai tidak muncul di aplikasi orang tua" in the symptom index (F3-11), which gives candidate elements, e.g. `Lock Student Grades`.
   - Walk backwards: the trigger (timer: regular bill overdue) → gateway condition → task.
   - Walk the reverse path: `Unlock Student Grades` and its condition (bill paid).
   - Find the role that can fix it: the lane of the reverse path's user task, e.g. finance.
   - The source is the BPMN element IDs, shown to the teacher as 2–4 plain steps with the current one highlighted (W4).
3. **Certainty:** payment status is outside the requested key scope (D4), so the bubble says "kemungkinan nilai terkunci menunggu administrasi SPP", never as a fact.
4. **Parent reply** (Siapkan balasan):
   - polite, **no amount, no "tunggakan"**, points to the finance office;
   - a code validator rejects digits that look like money, "Rp" and "tunggak*";
   - the teacher presses Kirim.
5. **No matching path (F3-14):** "Belum ada di proses sekolah", nothing invented.
6. F2-1 has three questions: "nilai tidak muncul", "sudah bayar sebagian tapi masih terkunci", "kalau bayar tunai kapan terbuka". Each must follow the BPMN path; pass is 3/3.

---

## 6. F1: grades from the photo (priority 2)

The pipeline in PR #192 stays (ADR-0009): two readers, deterministic checks, crop re-read, roster matching in code, one question per doubtful cell. Changes:

- **Roster and KKM from API v1** (§3.3) behind the `SchoolDirectory` port. The demo account's KKM is 80 and SDIT Nusantara's is 75, so it must come from data.
- **Read-back** compares `GET /nilai` rows (by `nis`) with the verified entries.
- **Lines for the three ways of working (§6.1 of the product PRD):**
  - way 1: the first two rows read in full ("Nilai Aisyah, 86"), then "Sisanya saya isi lebih cepat, Bu.";
  - way 2: "Ketik 84 untuk Dimas." / "Di buku 84, Bu.";
  - way 3: check after Simpan only.
- **Step notes (F0-14):** built from the actions log (menus clicked, form used), deterministically: "1. Buka menu Nilai → Isi nilai kelas. 2. Pilih kelas 4A, Matematika, UTS. …". A model only rephrases, and only if the template reads poorly.
- Photo arrives through WhatsApp Cloud API → `enqueuePhoto` → a card above the Nemu button (ID-03). The photo is deleted after processing (F1-12).

---

## 7. F4: Moodle quiz (priority 3)

### 7.1 Check as students see it (F4-01, F4-02, F4-05)

The input is the quiz preview snapshot from the extension (§3.2). The checks, mostly deterministic:

| Problem                 | How it's found                                                                                                                                                                                                                                                 |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Missing image**       | An `<img>` that failed to load; or a question that refers to "gambar (3)" or "(3)" while only two figures are present. The second is the exact Hermes case: count referenced labels against figures in code; a model only when references are phrased loosely. |
| **No answer key**       | The question bank or edit view shows no correct answer or fraction 100 (needs the teacher's edit rights; read only).                                                                                                                                           |
| **Count, class, times** | Compared against the teacher's request or the course section; the open/close times against the stated schedule.                                                                                                                                                |

- One problem per bubble, with **Lanjut** for the next one (W9).
- **Nothing is changed** while checking (F4-02). This works for any quiz, including ones made by Hermes.

### 7.2 Install from the teacher's script (F4-03)

- **Input:** PDF, Word or photo. Text-layer PDF and Word are parsed in code; a photo goes through the vision reader.
- **Output:** Moodle XML.
  - `multichoice` (single answer) for options a–d, `truefalse` per statement for "benar/salah" items.
  - Images embedded as base64 `<file>` with `@@PLUGINFILE@@` references.
  - The answer key is only what the script marks.
- **Nemu does not write questions** (no generation). An unreadable stem, option or key becomes a Kartu Pilih question.
- An image found on another page of the script is attached to the question that references it (the F4-2 case: one image on another page).
- A validator checks every question has stem, options and exactly one key before import. Steps in the Moodle UI are the executor's (F4-04), stopping before "Simpan dan tampilkan".

---

## 8. F3: school knowledge and BPMN

### 8.1 Any BPMN (F3-10)

- Extend `importBpmn` beyond tasks and gateways:
  - pools and lanes as roles;
  - start, end, intermediate and boundary events with their definitions (timer, message, error, signal);
  - message flows between pools;
  - service, script and user tasks;
  - `documentation`.
- Conditions stay deterministic (JUEL → Jexl, FEEL → feelin; ADR-0010). Label-only conditions become import warnings.

### 8.2 Symptom index (F3-11)

- **At upload, one model call per process** produces, for each task and end event, the symptoms a teacher or parent would see. For example `Lock Student Grades` → "nilai tidak muncul di aplikasi orang tua".
- **Each symptom references element IDs that must exist** in the graph; any that don't are dropped.
- Stored with the document; the operator can edit it in WS-04. It's used for retrieval in F2-08 and for questions.

### 8.3 Tracing (F3-12 to F3-14)

- **Pure graph code:**
  - from the symptom's elements, walk incoming flows to the trigger (start or boundary event) and the conditions on the way;
  - find the reverse path: tasks or events whose outgoing flows lead out of the state (e.g. Unlock);
  - the role is the lane or pool of each user task.
- **The model only phrases** the 2–4 plain steps from this structured path; it never adds a step. A validator checks that every element ID mentioned exists.
- If data can be checked through the API, check it before concluding (F3-13). If no path matches: "belum ada di proses sekolah".

### 8.4 Running a BPMN (F3-15 to F3-19)

- **Plan:** `planBpmnStep` (PR #192) walks the teacher's tasks, branches from conditions, asks for missing slots one at a time, and stops before Ajukan/Simpan. It's shown first as 2–6 plain steps (Kartu Pilih: Mulai / Ajari saya).
- **Field-to-label mapping (F3-16):**
  - match each BPMN form field (`id`, `label`) to the page's form labels: exact, then normalized, then fuzzy;
  - a model call only for the leftovers;
  - the mapping is stored per task (WS-04), so later runs make no model call.
- **Table photos for a process (F3-1 tahfidz):**
  - generalize the grade reader to any column schema derived from the BPMN's form fields (surah, ayat, 4 scores);
  - surah names are validated against `/hafalan/referensi`;
  - unreadable scores are asked, never guessed.
- **Other roles' and system tasks** are only announced: "Setelah Ibu menekan Simpan, nilai dihitung otomatis…" (F3-18).

### 8.5 Recording → BPMN (F3-01 to F3-03, F3-09)

- `compileProcedure` (PR #192) turns a recording into parameterized steps.
- `procedureToBpmn` turns those steps into a process:
  - one lane "Guru";
  - user tasks per step;
  - the human steps (Simpan) as user tasks named "Guru menekan Simpan".
- `bpmn-moddle` writes the XML; `bpmn-auto-layout` 1.3.0 (MIT) adds the diagram layout so it opens in bpmn.io and Camunda Modeler.
- Nemu's own F1 and F4 flows are written the same way and committed as `.bpmn` files (Javan minimum requirement).

### 8.6 Grounded answers (F3-04, F3-07, WS-09)

Unchanged (PR #192): retrieval, closed-world JSON, and every quote checked against an active chunk, otherwise "Belum ada di panduan sekolah." The bundled source is the AlurSekolah user guide (27 chapters). WS-09 answer testing calls the same function on not-yet-active knowledge.

---

## 9. Speech

- **Hold Ctrl+Space** (F0-02): audio is recorded only while held, so there's no end-of-speech detection. Latency drops by the 1.2 s silence wait; P50 is about 1.8 s to first audio.
- **Speech-to-text:** OpenRouter `openai/whisper-large-v3-turbo`, `language: "id"`, glossary prompt; `microsoft/mai-transcribe-2` as the alternative.
  - **F0-2 needs ≥ 8/10** on everyday sentences, two of them with Javanese mixed in. Build a 10-clip test set and compare both models before choosing.
  - The captured text always shows in the bubble (F0-03).
- **TTS:** OpenRouter speech with estimated word timings, or the local voice (ADR-0012). Speed 0.85×.
- **Voice controls while Nemu works** (F0-15): "pelan", "ulangi", "ajari saya", "lanjut", "berhenti", matched in code before any model.

---

## 10. Models (live OpenRouter prices, US$ per 1M tokens in/out, 2026-11-25)

| Task                                                              | Default                                                               | Budget                                 | Strict ZDR                       |
| ----------------------------------------------------------------- | --------------------------------------------------------------------- | -------------------------------------- | -------------------------------- |
| Photo Read A (structure + ranges)                                 | `google/gemini-4-hydrogen` 1.50/7.50                                  | `google/gemini-3.7-flash` 0.75/3.75    | `openai/gpt-6.2-sol` via Azure   |
| Photo Read B                                                      | `openai/gpt-6.1-terra` 1/5                                            | `anthropic/claude-haiku-5.5` 0.10/0.50 | `openai/gpt-6.1-terra` via Azure |
| Crop re-read (F1)                                                 | `openai/gpt-6.2-sol` 2/10 (third family; reads F1-1's hooked 71, 3/3) | `google/gemini-3.7-flash`              | `openai/gpt-6.2-sol`             |
| Teacher's script → Moodle XML (F4-03)                             | `anthropic/claude-haiku-5.5` (reads PDFs; 10/10 on F4-2, 7/7 runs)    | `google/gemini-3.7-flash`              | `anthropic/claude-haiku-5.5`     |
| Kamus fallback, symptoms, trace phrasing, slots, compile, answers | `anthropic/claude-haiku-5.5`                                          | `openai/gpt-6-luna`                    | `anthropic/claude-haiku-5.5`     |
| Speech-to-text                                                    | `openai/whisper-large-v3-turbo`                                       | –                                      | (verify ZDR)                     |

Every call sends `provider: {data_collection: "deny", require_parameters: true}` and a strict JSON schema; model IDs are environment configuration.

---

## 11. Safety and privacy

- **Never press Simpan, Kirim, Ajukan or Hapus:**
  - the AI's action vocabulary has no press;
  - the extension checks the deny list itself (F0-08);
  - test F0-1 feeds fake AI responses asking to click them, expecting 3/3 refused.
- **Page, PDF and WhatsApp text are data** (F0-12). Snapshots never carry input values; password screens are never read.
- **Children's data:**
  - roster and NIP never in prompts;
  - photos deleted after processing;
  - no grade values in logs (WS-10);
  - synthetic data only.
- **Parent replies (F2-08):** no amounts, no "tunggakan" (validator).
- The API key and AI keys stay on the Nemu Service (WS-07).

---

## 12. Cost and latency

- **Cost:**
  - the budget vision pipeline plus Haiku for text stays around **Rp2.800–5.100** per teacher per month;
  - F2 kamus matching is usually free, since deterministic matching comes first;
  - BPMN symptoms are one call per upload, not per question;
  - replays and mapped BPMN steps make no model call.
- **Latency:**
  - voice ≤ 4 s (hold-to-talk makes it easier);
  - photo page ≤ 60 s;
  - one class ≤ 5 min.

---

## 13. Evals and acceptance (AI evidence; PRD §11)

| Case                      | AI eval                                                                     | Pass                         |
| ------------------------- | --------------------------------------------------------------------------- | ---------------------------- |
| F2-1 grades not appearing | 3 questions on the SPP BPMN: path, element IDs, parent reply without amount | 3/3                          |
| F2-2 / F2-3               | Kamus match, fixer, self-fix target                                         | pass                         |
| F1-1 / F1-2               | `eval:school --live` on the official photo; way-2 lines                     | ≥ 95%, 0 wrong, ≤ 5 min; 2/2 |
| F4-1                      | Quiz with question 15 missing an image and question 7 missing a key         | 2/2, nothing changed         |
| F4-2                      | IPAS script, 10 questions, one image on another page                        | 10/10 in the XML             |
| F3-1 tahfidz              | BPMN uploaded with no code change; 3 rows from the setoran photo            | 3/3, 0 new code              |
| F3-2 guide                | 5 questions, correct pages                                                  | 5/5                          |
| F3-3 recording → BPMN     | Steps match the key; XML opens in bpmn.io                                   | 5/5                          |
| F0-1 safety               | Fake responses requesting Simpan, Kirim, Hapus                              | 3/3 refused                  |
| F0-2 speech               | 10 sentences, 2 with Javanese mixed in                                      | ≥ 8/10                       |
| WS-1                      | New SOP answers with its source after activation, no code change            | pass                         |

Per ADR-0003, a case is complete only when the extension path passes too.

---

## 14. ADRs

- **Existing (AI):** ADR-0009 two readers, ADR-0010 BPMN walked in code, ADR-0011 photo jobs in R2, ADR-0012 speech.
- **Existing (from the extension work):**
  - ADR-0013: WhatsApp photos arrive through whatsmeow.
  - ADR-0014: integration secrets are sealed in D1.
  - ADR-0015: the extension knows the teacher without a login.
  - ADR-0016: known sites are granted, and WS-03 decides.
  - ADR-0017: a new BPMN process runs from its own form.
- **To write with the code:**
  - **BPMN symptom index and tracing.** Symptoms are generated once at upload and point to element IDs; tracing is graph code; the model only phrases.
  - **Kamus as a table.** Deterministic matching first, a model only as fallback.

---

## 15. AI plan

| When      | Work                                                                                                      |
| --------- | --------------------------------------------------------------------------------------------------------- |
| Wed night | This doc; remove the desktop module; recreate the SPP BPMN from the mentor's image until the file arrives |
| Thu am    | Kamus table matching; text-only WhatsApp draft; API v1 client (read); `explainMissingGrade`               |
| Thu pm    | Any-BPMN import, symptom index, trace; F2-1 eval to 3/3                                                   |
| Thu night | F1 on the API (roster, KKM, read-back), lines for ways 1 and 2, step notes                                |
| Fri am    | F4-01 checks, F4-03 script → Moodle XML                                                                   |
| Fri pm    | F3-16 field mapping + tahfidz table reading; recording → BPMN export; Nemu's own flows as `.bpmn`; evals  |

---

## Appendix A: Handoff notes for the fullstack side (not AI scope)

- **Extension:**
  - MV3, one codebase for Chrome and Edge, active only on allowed sites (WS-03);
  - Shadow DOM overlay;
  - five display types (PRD §6.2), one at a time;
  - the cursor moves step by step (F0-16);
  - visible menu navigation (F0-13);
  - typing digit by digit in way 1.
- **Hold Ctrl+Space:** key down and up in the content script; the microphone needs an offscreen document in MV3 (verify on Edge). Fallback: press-and-hold the Nemu button.
- **DOM executor:**
  - locate by label, role and text (F0-06);
  - `isTrusted` checks to detect the teacher taking over (F0-07);
  - the deny list from `@nemu/ai/school/safety` plus no `form.submit()`, no Enter, and cancel untrusted submits.
- **Page snapshot and quiz preview snapshot** as in §3.2. No input values; nothing on password screens.
- **WhatsApp:** Cloud API test number → `teacherForSender` → `enqueuePhoto`; F2-05 opens `web.whatsapp.com/send?phone=…&text=…` with our `waDraft.text`, and the teacher presses Kirim.
- **Workspace pages:** WS-01 to WS-10, with the kamus table (WS-05) importable from Excel. WS-09 calls `helpAsk` on draft knowledge.
- **Moodle test instance:** Docker, version pinned, HTTPS, synthetic data.

## Sources (fetched 25 Nov 2026)

- PRD Nemu v2.3 and its changelog (team documents).
- AlurSekolah API v1 OpenAPI spec: `https://business.alursekolah.id/api/v1/openapi.json` (179 paths; bearer key `as_…`).
- OpenRouter models, ZDR, structured outputs, speech-to-text and speech endpoints (openrouter.ai/docs).
- bpmn-io: bpmn-moddle 10.3, bpmn-auto-layout 1.3.0, bpmn-js, feelin; camunda-bpmn-moddle 8.0.
- Hermes Agent docs (hermes-agent.nousresearch.com) for positioning.
- Earlier research (vision benchmarks, privacy, cost) as cited in PR #192's version of this document.
