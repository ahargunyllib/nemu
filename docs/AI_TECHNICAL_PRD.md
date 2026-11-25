# Technical PRD: Nemu v2.2 MVP, AI scope

Status: draft, 25 November 2026. It answers _how_ to build the **AI parts** of PRD Nemu v2.2 (the product PRD owns _what_).
Deadline: MVP working Friday 27 November 2026, night.

**Scope of this document.** We follow the same split as before: AI owns AI features as a vertical slice, as with `chat`, `documents` indexing and `rule-sources`.

**Ours (AI, Zahra):**

- **AI pipelines** in `packages/ai`, shared types in `packages/contracts`, and evals. Requirements: F0-04, F0-10, F1-03…07, F1-10, F2-02, F2-03, F2-06, F2-07, F3-03, F3-04, F3-07, F3-09, and the AI half of F3-01.
- **The backend modules that serve them** in `packages/api` (`grades`, `help`, `knowledge` extensions, `procedures`, `speech`), with their D1 migrations and server wiring (§2.3).
- **The photo job pipeline:** jobs in the R2 `inbox` bucket, read on request, polled by the laptop (§3.0, ADR-0011).
- **Screen reading on the desktop:** active-window capture, UIA and DOM text, password-screen blocking (§5.1).
- Small extension or admin changes needed to finish one of these end to end (ADR-0003), agreed with the partner first.

**Our fullstack partner's (SE, Billy):**

- the desktop shell (overlay, bubble, hotkey, mic UI, installer);
- the Chrome extension's fill, highlight, recorder and executor;
- **WhatsApp photo intake** (Cloud API webhook, QR upload page) and **the WhatsApp message hand-off**;
- login, and all UI screens.

The contract between us is §2. Their research notes are kept in Appendix A as handoff material. **They are not our tasks.**

Research behind every choice was done on 25 November 2026 against live sources (OpenRouter model and endpoint APIs, vendor docs, npm). Prices and model IDs move weekly, so re-check §8 before committing config. Anything marked **(verify)** was not confirmed from a primary source and has a day-0 spike in §14.

---

## 1. Decisions needed before code (AI-relevant)

Each has a default so work can start. Confirm or override today with the team.

| #   | Decision                                              | Default                                                                                                                                                                                                                                                                                                                                                               | Why it matters to AI                                                                                                                                                                 |
| --- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D1  | Strict zero data retention (ZDR) for children's data? | **Allow Safety Retention for the synthetic-data MVP**; record it in the DPIA                                                                                                                                                                                                                                                                                          | Since 2026-10-18 Gemini on OpenRouter is not available under strict ZDR. Strict ZDR forces OpenAI-via-Azure or Anthropic models for every call.                                      |
| D2  | Cost cap read per month or per semester average       | **Per-semester average** (Rp30.000 per semester)                                                                                                                                                                                                                                                                                                                      | Grade entry bunches at semester end. Only the budget vision pipeline fits a strict monthly cap.                                                                                      |
| D3  | Paid providers (AGENTS.md "Third-party providers")    | Already chosen: OpenRouter for vision, text, speech-to-text (`microsoft/mai-transcribe-2`) and TTS (`microsoft/mai-voice-2.1-flash`; its `/audio/speech` returns audio only, so word timings are estimated; ADR-0012). Azure AI Speech is not used. Not proposed: Mistral OCR, ElevenLabs, Soniox, Deepgram.                                                          | Until a provider is approved we ship an adapter interface with a fake; TTS falls back to the local OS voice. Edge TTS is unofficial and breaks Microsoft's consumer terms: dev only. |
| D4  | Scope split with the partner                          | **AI**, as a vertical slice:<ul><li>pipelines plus the deterministic logic that judges AI output (name matching, rules, BPMN walk, read-back diff, citation check);</li><li>the backend modules serving them;</li><li>the photo job pipeline;</li><li>screen reading.</li></ul>The partner owns the shell UI, the extension, WhatsApp intake and hand-off, and login. | Confirm with the partner so nothing is built twice or dropped.                                                                                                                       |

---

## 2. Boundary with the fullstack side

The AI code stays pure and testable: functions in `packages/ai` behind the existing `NemuService` seam (ADR-0001), with zod schemas in `packages/contracts`.

- Our own `packages/api` modules (§2.3) expose them as procedures.
- The partner's UI, extension and WhatsApp code call those procedures and own the transport to the teacher, auth and screens.
- Every model call takes an injected OpenRouter client, so tests run on fixtures.
- "Today" comes from the existing `NEMU_DEMO_DATE` seam.

### 2.1 What AI delivers (`packages/ai`)

| Function                     | Input                                                            | Output                                                                                  | PRD                 |
| ---------------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------- |
| `readGradePhoto`             | image bytes (EXIF-stripped), command slots                       | `GradeSheetReading`: rows, cells, readings A/B/re-read, confidence, reasons, crop boxes | F1-03               |
| `parseGradeExcel`            | xlsx bytes                                                       | same `GradeSheetReading` shape, with exact cells                                        | F1-02               |
| `matchNames`                 | raw names, roster                                                | per row: `studentId`, score, `auto\|ask\|unmatched`, top-2 candidates                   | F1-04               |
| `parseGradeCommand`          | transcript ("masukkan nilai UTS Matematika 4B"), teacher profile | `{kelas, mapel, jenis}` or a question                                                   | F1-05               |
| `applySchoolRules`           | verified grades, active Rule Sources                             | per student: value, blank, remedial; citations                                          | F1-07               |
| `buildVerificationQuestions` | reading + matches                                                | ordered one-per-screen questions (digit, name, S/I/A)                                   | F1-06               |
| `diffReadback`               | verified source, scraped Rekap Nilai rows                        | `{match: true}` or first mismatch, plus the one-sentence report                         | F1-10               |
| `guidedLine`                 | next student and value, typed value                              | "Ketik 77 untuk Budi." / "Di buku 77, Bu."                                              | F1-11, F0-10        |
| `explainError`               | UIA text, screenshot, kamus kendala chunks, teacher contacts     | `{status, entryId, owner, person, sentence, why, citation, waDraft}` or `not_in_guide`  | F2-02, F2-03, F2-06 |
| `answerGrounded`             | question, active chunks                                          | `{status, answer, citations[]}` verified against page text                              | F3-04, F3-07        |
| `importBpmn`                 | BPMN XML                                                         | normalized `ProcessGraph` (tasks, fields, gateways, lanes, docs) + import warnings      | F3-03               |
| `planBpmnStep`               | `ProcessGraph`, teacher sentence, slots so far                   | next step `{fill \| ask \| human}` with the branch decision and source                  | F3-09               |
| `compileProcedure`           | raw recorded events + narration transcript                       | `Procedure` (parameterized steps, human steps marked)                                   | F3-01 (AI half)     |
| `transcribe`                 | audio (16 kHz mono)                                              | `{text}`                                                                                | F0-04               |
| `synthesize`                 | one sentence                                                     | `{audio, words[{text, offsetMs, durationMs}]}`                                          | F0-05, F0-10        |

All model-facing prose follows F0-10:

- one sentence of about 10 words;
- words that are on the screen;
- no technical terms;
- never "salah".

### 2.2 What AI needs from the fullstack side

| Need                                                                                                                                                       | Why                                                                                                    |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| WhatsApp webhook and QR page call `inbox.enqueue({teacherId, source, mediaId \| bytes, msgId})` after verifying the signature and dropping unknown senders | Starts the photo job pipeline (§3.0)                                                                   |
| Desktop shell gives our `screen-reader` module an F8 key-down event, the foreground window handle, and a socket to the laptop session                      | Capture timing and push (§5.1)                                                                         |
| Extension answers `getPageText()` over the bridge: visible alert and error text, active field labels, never input values                                   | F2 on web apps (§5.1)                                                                                  |
| Roster, teacher profile (name, class, subject, NIP, contacts of kepsek and operator)                                                                       | Matching (kept out of prompts), F2 person names, WhatsApp draft                                        |
| Scraped Rekap Nilai rows after Simpan                                                                                                                      | `diffReadback`                                                                                         |
| Typed value per field in guided mode                                                                                                                       | `guidedLine`                                                                                           |
| Recorded events with locators, values, timestamps, plus narration audio                                                                                    | `compileProcedure`                                                                                     |
| WhatsApp hand-off opens our `waDraft` (text plus the screenshot we captured)                                                                               | F2-05                                                                                                  |
| Uploaded PDFs and BPMN files, and the active/inactive flags                                                                                                | Grounding and BPMN import                                                                              |
| A deny list enforced by the executor (Simpan, Kirim, Ajukan, Hapus…)                                                                                       | Defense in depth. AI never emits those actions, but the executor must also refuse them (Appendix A.5). |

### 2.3 Backend modules we own (`packages/api`, procedure → service → repository)

As built (25 Nov). Full call order: `docs/school-ai.md`.

| Module                 | Procedures                                                                                                                                         | Notes                                                                     |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `inbox`                | `inboxUploadPhoto`, `inboxJobs`, `inboxProcess`, `inboxPhoto`, `inboxAck`; service `enqueuePhoto` and `teacherForSender` for the partner's webhook | Jobs in R2 (§3.0)                                                         |
| `grades`               | `gradesParseCommand`, `gradesParseExcel`, `gradesFinalize`, `gradesReadback`, `gradesGuidedLine`                                                   | Stateless: the client keeps the reading                                   |
| `help`                 | `helpExplain`, `helpAsk`, `helpRoute`                                                                                                              | Kamus, SOP, BPMN and procedure chunks from the active workspace           |
| `processes`            | `processList`, `processXml`, `processPlan`, `procedureCompile`, `procedureSave`, `procedureList`, `procedureGet`, `procedureRun`                   | BPMN and procedures are knowledge documents (`format: bpmn \| procedure`) |
| `speech`               | `speechTranscribe`, `speechSynthesize`                                                                                                             | OpenRouter; no key reaches the laptop                                     |
| `school`               | `SchoolDirectory` port (demo SDIT Nusantara), knowledge and Rule Source helpers                                                                    | The partner replaces the directory with L-02 data                         |
| `documents` (extended) | `.bpmn` upload, indexed per task                                                                                                                   |                                                                           |

Infra (`packages/infra/alchemy.run.ts`):

- the R2 bucket `inbox` with a 1-day lifecycle rule (separate from `documents`), bound as `INBOX`;
- `OPENROUTER_SCHOOL_*`, `OPENROUTER_STT_MODEL`, `OPENROUTER_TTS_*`, `OPENROUTER_ZDR` values with defaults;
- the seed migration `20261125120000_seed_school_workspace` (workspace `W-SEKOLAH`, Bu Siti and Pak Rizal, synthetic SOP and kamus).

The partner adds the WhatsApp secrets with the webhook.

---

## 3. F1: grade book (AI)

### 3.0 Photo job pipeline (ours, ADR-0011)

```
partner: WhatsApp webhook ──teacherForSender? → enqueuePhoto──┐
laptop / QR page ──────────────── inboxUploadPhoto ───────────┤
                                                              ▼
            R2 inbox/<teacher>/<job>/photo (EXIF stripped) + job.json (status)
laptop: poll inboxJobs → inboxProcess(job, class, assessment) → readGradePhoto (25–40 s)
        → job.json: ready + reading + verification | reshoot | failed
laptop: inboxPhoto (crops for W5) … teacher saves … inboxAck → delete photo + job
```

- **Read on request, not after the webhook.** Meta needs a fast 200, so the webhook only stores the photo; the vision call runs inside the laptop's `inboxProcess` request. A job already `processing` is not read twice; one stuck for 3 minutes may be read again.
- **Retention:** explicit delete on `inboxAck`, the 1-day R2 lifecycle rule as backup, no grade values or names in logs.
- **Why not a Durable Object:** the Alchemy version here binds Durable Objects through Effect-based workers and our Worker is plain Hono; R2 avoided an untested infra change two days before the demo. A push can replace polling later.
- Excel needs no job: `gradesParseExcel` answers in one request.

### 3.1 Photo reading

No published benchmark shows ≥95% _unassisted_ accuracy on handwritten forms. Handwritten forms score 80–84% (IDP leaderboard, Mar 2026). Two failure modes matter:

- **Blank cells filled with a value** (IDP leaderboard, 2026).
- **"Prior-driven" corrections:** the model writes what is likely, not what is written, as with 71→77 or Riski→Rizky. These are 63–91% of errors in WildHandBench (Aug 2026).

So the ≥95% target and "every ambiguous cell flagged" come from **two independent readers plus deterministic checks**, not from model confidence.

**Model confidence is unusable as the gate:**

- No Gemini, GPT or Claude endpoint on OpenRouter exposes logprobs (checked 2026-11-25).
- Logprobs and verbalized confidence collapse at useful thresholds (arXiv 2606.24420).

Pipeline:

0. **Quality gate.**
   - The image arrives at ≤2048 px.
   - If Read A reports `page_quality.readable=false`, return `reshoot` with the reason. Don't guess.
   - Ask teachers to send **HD** or as a document, because WhatsApp's standard quality shrinks photos to about 1600 px.
1. **Read A.** Structure, row y-ranges and column x-ranges (0–1000, Gemini `box_2d` convention), raw names, raw cells with `kind` (number, absence, blank, illegible), `struck`, `replaced_by`, `has_initial`, `unsure` and up to two `alternatives`.
   - Strict `json_schema` with `provider.require_parameters: true`; reasoning effort low.
   - Prompt: "copy exactly; never correct spelling; empty is `blank`, never 0".
   - **The roster is not in this prompt.** That prevents snapping names to the roster and keeps the roster away from the model.
2. **Read B**, in parallel: a **different model family** and different wording, same schema without ranges.
3. **Deterministic checks.**
   - Value grammar: integer 0–100 (decimal comma allowed), S, I, A or blank.
   - Row count equals the roster size.
   - Column outlier: |z| > 2.5, or more than 30 points from the student's other scores.
   - Every 0, struck or initialed cell is flagged.
4. **Agreement.** Auto-accept a cell only if A equals B, neither marks it `unsure`, and every check passes.
5. **Crop and re-read** every other cell.
   - Crop = row band ∩ column band, plus 15% padding.
   - Up to 12 crops per call to the stronger model. Its answer is only the _suggestion_; the cell is still asked.
   - Crops are cut with the Images binding or `@cf-wasm/photon` (WASM). Confirm with the partner where this runs.
6. **Bucket.** `high` = auto, `medium` = A≠B but the re-read matches one, `low` = everything else. Keep `reasons[]`: `models_disagree`, `self_unsure`, `struck`, `initial`, `out_of_range`, `outlier`, `zero_or_blank`, `name_ambiguous`.

**Flag precision matters too.** Test F1-1 expects **exactly 10 questions**: 4 digits, 5 names, and Raka Aditya (S).

- Over-flagging fails the test and annoys the teacher, so the eval tracks flags per page next to flag recall.
- Name questions come from §3.3, not from the readers.

Read A output schema (compact keys keep output tokens, the main cost, down):

```json
{
  "page_quality": { "readable": true, "issues": ["glare"] },
  "columns": [{ "key": "c1", "header_raw": "UTS", "x": [312, 388] }],
  "rows": [
    {
      "row": 10,
      "y": [402, 431],
      "name_raw": "Farah Anisa",
      "name_struck": false,
      "cells": [
        {
          "col": "c1",
          "raw": "7?",
          "kind": "number",
          "value": "77",
          "absence": null,
          "struck": false,
          "replaced_by": null,
          "has_initial": false,
          "unsure": true,
          "alternatives": ["71", "77"]
        }
      ]
    }
  ]
}
```

`GradeSheetReading` row, as returned to the fullstack side for W5 and the fill:

```json
{
  "studentId": "…",
  "rosterName": "Farah Annisa",
  "nameRaw": "Farah Anisa",
  "nameScore": 0.93,
  "nameStatus": "auto|ask|unmatched",
  "cells": [
    {
      "column": "UTS",
      "raw": "7?",
      "value": null,
      "status": "value|blank|S|I|A",
      "confidence": "high|medium|low",
      "reasons": ["models_disagree", "self_unsure"],
      "readings": { "a": "77", "b": "71", "reread": "71" },
      "bbox": [312, 402, 388, 431]
    }
  ]
}
```

Latency: A and B in parallel take 12–25 s, the re-read 8–12 s, so **25–40 s per page**, inside the 60 s target. Models and prices are in §8.

### 3.2 Excel parsing

- **SheetJS CE 0.20.3** from the CDN tarball (`bun add https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`).
  - npm's `xlsx` is frozen at 0.18.5 with known advisories.
  - Load it with a dynamic `import()` to stay inside the Worker startup CPU limit.
- Parse with `sheet_to_json(ws, {header: 1, raw: false, defval: ""})`, then pick the sheet with the most roster hits.
- **One cheap call** maps headers. Send the first 15 rows with masked sample values.
  - It returns `{headerRow, nameCol, gradeCols[], skipRowRegex}`.
  - Grade values never go to the model.
- A deterministic pass does the rest:
  - skip title, blank and summary rows (`rata-rata|jumlah|rerata|tertinggi|terendah|kkm`);
  - normalize CAPS names;
  - `"78,5"` → 78.5; `-`, `""`, `TL` → blank;
  - flag values over 100.
- F1-2 expects 31 correct, 1 blank reported, 3 name variants confirmed, and the average row ignored.

### 3.3 Name matching (deterministic)

1. **Normalize.**
   - Lowercase; strip titles and punctuation.
   - Old spelling: dj→j, tj→c, oe→u, nj→ny, sj→sy, ch→kh, dh→d, th→t.
   - Final y↔i (Rizky/Rizki); collapse double letters.
   - `muhammad|mohammad|muhamad|moch|moh|muh|mhd|m.` → `m`; `achmad|ahmat` → `ahmad`; `st` → `siti`.
2. **Score.**
   - Greedy token alignment: an initial matches a token with the same first letter at 0.9; otherwise max(Jaro-Winkler, normalized Levenshtein).
   - Small penalty for dropped trailing tokens.
   - Plus 0.3 × fuzzball `token_set_ratio`.
   - Libraries: `talisman`, `fuzzball`, `fastest-levenshtein`.
3. **Assign** one-to-one with the Hungarian algorithm (`munkres`), with a +0.03 bonus when |row − attendance number| ≤ 2.
4. **Thresholds.**
   - Auto-accept at score ≥0.90 **and** margin ≥0.08 over the runner-up.
   - Ask with the top two candidates when 0.70–0.90, or when Read A and Read B disagree on the name.
   - Below 0.70, ask "Siapa ini?" with the remaining students plus "Tidak ada di daftar".
   - Never auto-accept on an initial alone.
   - Tune on F1-1, which has exactly 5 variants.

### 3.4 School rules (deterministic, cited; ADR-0005, ADR-0007)

- Rule Sources with keys `kkm` (SOP hlm. 2, 3.2), `remedial_cap` (at most twice, capped at 75; 3.3), `input_deadline` (≤7 working days; hlm. 3, 4.1) and `absence_blank` (4.3).
- Code applies them and returns citations for **Sumber**.
- F1-1 expects 13 values under 75 marked remedial and Raka blank.
- "Cuti melahirkan" has no rule, so the answer is "belum ada di panduan sekolah".

### 3.5 Command, read-back and guided lines

- `parseGradeCommand`: one cheap structured call, with class and subject validated against the teacher profile. A missing slot means one question (F1-05).
- `diffReadback`: pure code. Report "Sudah saya cek, sama dengan buku." or the first mismatched student by name.
- `guidedLine`: templates, not a model call. Pre-render names and numbers 0–100 for TTS stitching (§7.3).

---

## 4. F3: school knowledge (AI)

### 4.1 Compiling recorded procedures

Input comes from the partner's recorder: per step a locator (role, accessible name, label, CSS), a value, a URL and a timestamp, plus narration audio.

1. **Deterministic clean-up.** Merge keystrokes into one fill step, drop jitter and stray focus clicks, align narration sentences to steps (±1.5 s).
2. **One compile call** per recording (about $0.002):
   - mark demo values as parameters (`{{kelas}}`, `{{mapel}}`, …), each with an Indonesian question;
   - write one instruction per step (≤10 words);
   - set `requiresHumanAction` on Simpan, Kirim, Ajukan and Hapus. A code deny list sets the same flag independently, and the stricter of the two wins.
3. **Replay makes no model calls** (PRD §8 cost rule). If every locator fails, there is one fallback call: a screenshot plus the step intent returns a box to point at. It is logged.
4. F3-3 expects 10 steps and 4 parameters, as in `F3-3_langkah-yang-diharapkan.json`. That file is the compile eval's golden output.

Prior art, used for reference only: browser-use `workflow-use` and Skyvern (both AGPL), and Stagehand's cached-action pattern.

### 4.2 BPMN

**Supersedes the "no BPMN runtime" choice in ADR-0006, so it needs a new ADR (§13).**

AlurKerja runs a maintained **Camunda 7 fork** (alurkerja.com; unverified against a real export). Expect `camunda:*` extensions and JUEL `${…}` conditions.

- **`importBpmn`:** `bpmn-moddle` 10.3 + `camunda-bpmn-moddle` 8.0.1 (both MIT), plus a generic `extensionElements` reader for unknown namespaces. Extract:
  - tasks, with documentation and lane or role (`camunda:assignee` / `candidateGroups`);
  - form fields (`camunda:formData/formField`; otherwise variables referenced in conditions);
  - exclusive gateways, with each flow's `conditionExpression` and the gateway's `default`.

  Warn at import about gateways whose conditions exist only as labels. Convert them to FEEL once, with the operator's review.

- **`planBpmnStep`:**
  - One slot-extraction call: the teacher's sentence plus a JSON schema generated from form fields and gateway variables, with today's date from the clock seam.
  - Then walk the graph deterministically.
  - Evaluate conditions with `@bpmn-io/feelin` 7 (FEEL), or with `jexl` for JUEL after stripping `${}`. Neither uses `eval`, so both are safe in Workers.
  - A missing variable at a gateway means **ask one question**. No branch true means take `default`.
  - A task in the Guru lane whose action is Ajukan becomes a `human` step.
- **F3-1** with `NEMU_DEMO_DATE=2026-12-01` (a Tuesday): "Izin Kamis, anak sakit" → keperluan keluarga, 1 hari, 3 Des 2026, no doctor's note (the rule "sakit > 1 hari → surat dokter" covers the teacher's own illness), then kepsek approval. The two extra questions are in `00_BACA-DULU`.
- Viewer highlighting (`bpmn-js`) is the partner's, A.4. We return the `taskId` to highlight.
- **Ask Javan** for:
  - a real Studio export;
  - which form-field namespace it uses;
  - which condition language it uses (JUEL, FEEL or labels);
  - where roles live;
  - whether diagram coordinates are included;
  - the `direct-start` / `direct-complete` endpoints.

  Until it arrives, author the F3-1 BPMN in Camunda Modeler (Camunda 7 format).

### 4.3 Grounded answers and "belum ada di panduan sekolah"

Extends the existing `retrieveKnowledge` and citation rules:

1. **Retrieval:**
   - lexical (BM25, needed for KKM, NIP, Dapodik and error strings), or
   - the whole kamus kendala plus SOP in context when they are small (10–30 pages).
2. **Pre-LLM gate:** no chunk above the threshold means abstain without calling the model.
3. **Closed-world JSON:** `{status: answered|not_in_guide, answer, citations: [{doc_id, page, point, exact_quote}]}`.
   - Use non-reasoning mode: AbstentionBench (Meta FAIR, 2025) shows reasoning models abstain about 24% less.
   - General knowledge only rephrases (F3-07).
4. **Deterministic verification:**
   - every `exact_quote` must be a normalized substring of that page of an active chunk;
   - otherwise downgrade to "belum ada di panduan sekolah".

   This builds on ADR-0005, where cited sources must resolve to active knowledge.

5. **Eval set:** 10 in-scope, 10 near-miss negatives (for example cuti melahirkan, an error code missing from the kamus), and 5 underspecified. Targets:
   - abstention recall 100% on the PRD set;
   - citation faithfulness 100%;
   - abstention precision ≥90%.

---

## 5. F2: help when stuck (AI)

`explainError` makes one call with:

- the UIA or DOM text (exact strings; Chrome exposes web pages to UIA by default from Chrome 138);
- the active-window screenshot;
- the kamus kendala chunks.

1. The model extracts the visible error and returns `{entry_id, page, exact_quote}` or `not_in_guide`.
   - The quote is verified as in §4.3.
   - **Fault and owner come from the matched kamus entry (data), not from the model.**
   - The person's name and number come from the teacher profile.
2. Main sentence: "Bukan kesalahan Ibu. Yang bisa memperbaiki: Pak Ahmad (kepsek)." The meaning goes in `why` (behind **Kenapa?**), the citation in `citation` (behind **Sumber**).
3. If the kamus says the teacher can fix it, return `{mode: "guided", target}` with the control's accessible name. The partner resolves the screen position; if that fails, a vision call returns a box (Gemini `box_2d` or `bytedance/ui-tars-1.5-7b`).
4. If someone else has to fix it, return `waDraft`: polite, short (problem, NIP, "screenshot terlampir"), ready for the partner to open in WhatsApp. **The teacher presses Kirim.**
5. **Never** ask for passwords or authenticator codes (F2-07). This is a validator on every output: any request for `kata sandi|password|kode|OTP|autentikator` fails.
6. Pass criteria: 6/6 cases match `F2_kunci-jawaban.csv` (meaning, owner, action); F2-6 gives "belum ada di panduan sekolah"; sources show on cases 1–5.

### 5.1 Screen reading (ours, `packages/ai/src/desktop`, imported by the desktop main process)

A self-contained module inside the partner's Electron app. One entry point, `readActiveWindow(): {title, url?, text[], elements[], screenshot}`, behind a `ScreenReader` interface so macOS can add an AX implementation later (A.3).

1. **When.** Capture on **F8 key-down**, not after speech, and upload in the background, so the image is already on the Service when the transcript arrives (saves 150–350 ms, §7.4). The mic and screenshot are active only when called, and only for the active window (F0-03).
2. **Screenshot.**
   - `desktopCapturer` (screen source) cropped to the foreground window rectangle (`get-windows` or `GetWindowRect` via `koffi`).
   - Downscale to ≤1280 px and encode as JPEG q80, about 60–120 KB, with no metadata.
   - The partner's overlay uses `setContentProtection(true)`, so Nemu's own dot and bubble aren't in the image.
3. **Text, in priority order:**
   - **(a)** Web page with the extension present: `getPageText()` over the bridge, giving alert and error text, `role=alert`, toasts and field labels (exact, about 5 ms).
   - **(b)** Any window, including Chrome (UIA is on by default from Chrome 138): UI Automation through a persistent PowerShell host using `System.Windows.Automation`.
     - Keep one process open, because a fresh spawn costs a few hundred ms.
     - Or use `@mediar-ai/terminator`, pinned to a version, since it has many breaking releases.
     - Read Name and Value of `Text`, `Edit` (non-password), `Pane` with `LiveSetting`, and dialog descendants, capped at about 200 elements.
   - **(c)** Nothing found: the screenshot alone; the vision fallback in §5 reads it.
4. **Elements for pointing:** `{name, controlType, rect}` for buttons and fields. These are used by guided mode and by F2's "the teacher can fix it" target, so most pointing needs no model call.
5. **Privacy guard. Block capture and send nothing** when either:
   - the foreground window has a UIA element with `IsPassword=true` or the page has `input[type=password]`; or
   - the window title matches `login|masuk|sign in|otp|autentikator|kata sandi`.

   The bubble then says the screen can't be read while a password is visible. Never collect input values.

6. **Tests:** a fixture HTML page with an error banner plus a password page, read through the extension path. A Windows-only smoke test runs UIA on Notepad and a Chrome tab. A test asserts that nothing is captured when a password field is focused.

---

## 6. Command understanding (F0-04, F0-10, F0-11)

- One cheap structured call routes the transcript to an intent:
  - `input_nilai`, `kenapa`, `izin` / a BPMN process, `ajari_saya`, `berhenti`, `lanjut`, `ulangi`, `saya_saja`, or `unknown`.
- The voice controls `berhenti`, `lanjut`, `ulangi` and `saya saja` are **matched in code before any model call**, so Berhenti is instant and costs nothing (F0-06).
- Output sentences are checked by a validator:
  - ≤ 1 sentence and about 12 words;
  - no "salah";
  - must mention the menu or button name when guiding (F0-11).

---

## 7. Speech (AI)

### 7.1 Turn-taking (we specify; partner builds)

**One key, two gestures** (55+ users tire holding a key; always-on listening breaks F0-03):

- **Tap F8** opens the mic. Silero VAD v6 (ONNX/WASM, about 2 MB, MIT) closes it. Settings:
  - `threshold 0.6`, to reject staff-room noise;
  - `min_speech 250 ms`: under that, discard locally and call nothing;
  - `min_silence 1200 ms`, which tolerates word-finding pauses;
  - `max 15 s`.
- **Hold F8 over 400 ms:** release stops at once.
- **Selesai** button or a second tap: stops at once.

Capture at 16 kHz mono with `echoCancellation`, `noiseSuppression` and `autoGainControl` on.

### 7.2 `transcribe`

F0-04 requires showing the text Nemu heard, so use a **separate transcription step**, through OpenRouter `POST /api/v1/audio/transcriptions` (batch only):

| Option                                              | Price                            | Notes                                                                                                                                                                                  |
| --------------------------------------------------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `microsoft/mai-transcribe-2` (default)              | ≈ $0.10/hour                     | 60 languages including Indonesian, phrase biasing, code-switching. `language: "id"` plus a glossary prompt: AlurSekolah, e-Rapor, Ruang GTK, KKM, NIP, remedial. **No student names.** |
| `openai/whisper-large-v3-turbo`                     | ≈ $0.011/hour                    | FLEURS-id WER about 7%; weaker on heavy code-switching. Cheapest alternative.                                                                                                          |
| Gemini audio input in one chat call (`input_audio`) | ≈ $0.30–1.00 per 1M audio tokens | Saves one hop (350–700 ms) and lets the screenshot disambiguate jargon. Return `{transcript, reply}`. Needs Safety Retention (D1), so it's the latency fallback.                       |

Streaming speech-to-text (Soniox, Deepgram Nova-3) is post-MVP and needs D3.

### 7.3 `synthesize` (word timing, 0.85×)

| Option                                                                                          | Word timing                                                  | 0.85×                                                           | Cost                                                              | Use                                                                                                     |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | --------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| **MAI-Voice-2.1-Flash** via OpenRouter `/audio/speech`, voice `id-ID-Harper` (or `id-ID-Grant`) | Estimated from text, rescaled to the audio length (ADR-0012) | `speed: 0.85` (verify: the model lists no supported parameters) | $15 per 1M characters, no free tier                               | **Default**                                                                                             |
| Local OS voice through `speechSynthesis` (Windows: Microsoft Andika id-ID; macOS: Damayanti)    | `onboundary` (verify)                                        | `rate = 0.85`                                                   | 0                                                                 | Fallback when `OPENROUTER_TTS_MODEL` is empty or the call fails; cheapest option for low-budget schools |
| Azure AI Speech `id-ID-GadisNeural` / `ArdiNeural`                                              | `WordBoundary` over WebSocket                                | `<prosody rate="-15%">`                                         | F0 free 500k characters per month per subscription; S0 $15 per 1M | Not used: needs a separate Azure account                                                                |
| Edge TTS                                                                                        | `WordBoundary`                                               | `-15%`                                                          | 0                                                                 | Dev only. The PRD names it, but it breaks Microsoft's consumer terms and fails with 403s.               |
| ElevenLabs Flash v2.5 `/with-timestamps`                                                        | yes                                                          | `0.85`                                                          | ≈ $40–50 per 1M characters                                        | Emergency demo only                                                                                     |
| Google Chirp 3 HD, OpenAI TTS, Gemini TTS                                                       | no reliable word timing                                      | —                                                               | —                                                                 | Rejected                                                                                                |

- The Worker calls OpenRouter, so no key is on the laptop. It returns `{audio, words[]}` with `timing: "estimated"`.
- Estimate it from audio duration weighted by characters, adding 180 ms at commas and 300 ms at full stops.
- Cost control:
  - cache fixed phrases by `sha256(voice+rate+text)`;
  - in guided mode, stitch pre-rendered names and numbers 0–100;
  - the bubble text **is** the spoken text, so voice and text are identical (F0-05).

### 7.4 Latency to first audio (≤ 4 s after the teacher stops talking)

| Stage                                                     | Tap + VAD (default)         | Hold or Selesai     |
| --------------------------------------------------------- | --------------------------- | ------------------- |
| End-of-speech wait                                        | 1 200 ms                    | 0                   |
| Upload audio                                              | 100–180 ms                  | 100–180 ms          |
| `transcribe` (mai-transcribe-2, verify in S2)             | 350–700 ms                  | 350–700 ms          |
| Model (one sentence, reasoning off; F2 adds a screenshot) | 650–1 300 ms                | 650–1 300 ms        |
| `synthesize` first audio + word timing                    | 200–400 ms                  | 200–400 ms          |
| Client render                                             | 60–100 ms                   | 60–100 ms           |
| **P50 / P90**                                             | **≈ 2.9 s / 3.9 s (tight)** | **≈ 1.8 s / 2.7 s** |

AI-side tactics that keep it under 4 s:

- reasoning off for voice turns;
- one short sentence;
- return the text before the audio so the bubble shows first;
- if P90 is over 4 s, switch to Gemini single-hop audio.

Our `screen-reader` uploads the screenshot at F8 key-down (§5.1). The partner's bubble plays a chime and shows "Sebentar ya, Bu…" at t=0.

---

## 8. Model matrix (live OpenRouter prices, US$ per 1M tokens in/out, 2026-11-25)

OCR scores are from the Roboflow leaderboard of 2026-11-19, with text-localization scores in brackets.

| Task                                                               | Default                                                                | Budget                                                                 | Strict-ZDR (if D1 says so)                             |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------ |
| Photo Read A (structure + ranges)                                  | `google/gemini-4-hydrogen` 1.50/7.50, OCR 87.2 (loc 84)                | `google/gemini-3.7-flash` 0.75/3.75, OCR 78.8 (loc 59)                 | `openai/gpt-6.2-sol` via Azure 2/10, OCR 89.0 (loc 83) |
| Photo Read B (cross-check)                                         | `openai/gpt-6.1-terra` 1/5, OCR 84.4                                   | `anthropic/claude-haiku-5.5` 0.10/0.50 (OCR 65; weak on single values) | `openai/gpt-6.1-terra` via Azure                       |
| Crop re-read                                                       | `google/gemini-4-hydrogen`                                             | `google/gemini-3.7-flash`                                              | `openai/gpt-6.2-sol`                                   |
| Excel headers, command routing, slot extraction, procedure compile | `anthropic/claude-haiku-5.5` 0.10/0.50 (strict ZDR via Vertex/Bedrock) | `openai/gpt-6-luna` 0.10/0.50                                          | `anthropic/claude-haiku-5.5`                           |
| F2 explain, grounded answers (non-reasoning)                       | `anthropic/claude-haiku-5.5`                                           | —                                                                      | same                                                   |
| F2 vision fallback (no UIA text)                                   | `google/gemini-3.7-flash`                                              | —                                                                      | `openai/gpt-6.1-terra` via Azure                       |
| Pointing fallback (box)                                            | `google/gemini-3.7-flash` `box_2d`                                     | `bytedance/ui-tars-1.5-7b` 0.10/0.20                                   | `openai/gpt-6.1-terra`                                 |
| Speech-to-text                                                     | `microsoft/mai-transcribe-2`                                           | `openai/whisper-large-v3-turbo`                                        | (verify ZDR)                                           |

Notes:

- **Don't use Claude for Read A.** Its localization score is 46–61%, and the crops depend on the row and column ranges.
- Dedicated OCR services don't fit:
  - Azure Read and AWS Textract don't support Indonesian handwriting.
  - Google Document AI failed a 2026 handwritten-form test.
  - Mistral OCR 4 ($0.004/page, word confidences) is the only optional experiment, and needs D3.
- **Every request** sends:
  - `provider: {zdr: true, data_collection: "deny"}` where available;
  - `require_parameters: true` with a strict `json_schema`;
  - low reasoning effort.
- Model IDs are env config, like today's `OPENROUTER_GENERATOR_MODEL`, never hard-coded.

---

## 9. AI-side safety

1. **No submit actions from AI.** No AI output type can express "press" or "click submit".
   - The action vocabulary is `point`, `setValue`, `selectOption`, `ask`, `human`.
   - Steps on Simpan, Kirim, Ajukan or Hapus are always `human`.
   - A validator fails any output targeting a denied name (extending the existing K1-08 submit guardrail validator).
   - The partner's executor enforces the same independently (A.5).
2. **Grounding.** Rules and procedures come only from the workspace (§4.3). Deterministic code owns facts (ADR-0005).
3. **Never ask for passwords or authenticator codes** (validator, §5).
4. **Prompt injection.** Screen text, PDFs and Excel cells are data. Keep the existing safety classifier (ADR-0005), and apply it to UIA text and kamus content too.

---

## 10. Privacy (AI data minimization)

Not legal advice.

**Status.** UU PDP 27/2022 is in force. PP 33/2026 takes effect 2027-01-16:

- it requires verified parental consent for children's data;
- the PDP agency and its standard contract clauses don't exist yet, so there is **no clean cross-border route**.

Every OpenRouter endpoint here is "global", so every call is a transfer.

AI rules:

- **The roster is never sent to a model.** Matching runs in code.
- No NIP or NISN in prompts. The NIP is added to the WhatsApp draft by code after the model returns.
- Excel: header rows plus masked samples only.
- Speech-to-text glossary without student names.
- No prompt or response logging. ZDR per request where available; Gemini needs Safety Retention (D1).
- Eval data is synthetic only (SDIT Nusantara).

---

## 11. Cost (AI lines)

FX: Rp18.227 per US$ (2026-11-25), so **Rp5.000 ≈ US$0.274 per month**.

Load: 40 pages and about 300 commands per semester, which is 6.7 pages and 50 commands per month on average.

| Line                           | Choice                                                 | Rp per teacher per month (average)                                                                                                                                                                                |
| ------------------------------ | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vision, default pipeline       | Hydrogen + Terra + re-read (≈ $0.053/page)             | ≈ 6.500 ✗                                                                                                                                                                                                         |
| Vision, budget pipeline        | 3.7 Flash + Haiku 5.5 or Terra-low ($0.016–0.034/page) | ≈ 1.950–4.150                                                                                                                                                                                                     |
| Commands (F2, F3, routing)     | Haiku 5.5, ~6k in / 450 out, 1.5 calls                 | ≈ 750                                                                                                                                                                                                             |
| Speech-to-text                 | mai-transcribe-2, ~5–10 min                            | ≈ 150–300 (whisper-turbo ≈ 15–40)                                                                                                                                                                                 |
| Text-to-speech                 | MAI-Voice-2.1-Flash, or the local voice                | With caching ≈ 1.100–1.600; uncached ≈ 5.500 ✗; local voice 0                                                                                                                                                     |
| Cloudflare (Workers, R2 inbox) | $5 per month shared; photos deleted within a day       | ≈ 90–180 at 500–1.000 teachers                                                                                                                                                                                    |
| **Total**                      | budget vision, MAI speech, cached TTS                  | **≈ Rp4.000–7.000**: over the cap unless vision stays near its low end (read only the commanded column, compact output). With the local voice ≈ Rp2.900–5.400. WhatsApp inbound is free and we never reply there. |

What keeps it under the cap:

- no model call per replayed step;
- compact JSON, since output tokens dominate;
- low reasoning effort;
- cached TTS.

**Day-1 action:** measure real tokens on the F1-1 photo and pick the cheapest vision variant that gives 100% flag recall with ≤10 flags.

---

## 12. Evals and acceptance (AI evidence)

Extend the existing `packages/ai` harness (`eval`, `eval:offline`, `eval:live`). Per ADR-0003, a PRD case is complete only when the partner's end-to-end path also passes. AI evidence alone is "partial".

| Case           | AI eval                                                                                                                                                | Target                                  |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------- |
| F1-1 photo     | Cell accuracy before checking, **flag recall on wrong cells**, flags per page (= 10), name matches (5 asked), 13 remedial, Raka blank, latency, $/page | ≥95% correct, 100% flag recall, ≤60 s   |
| Own pages      | ≥5 pages the team writes by hand (pens, slant, light)                                                                                                  | Same, to avoid overfitting to one photo |
| F1-2 Excel     | Deterministic parse test                                                                                                                               | 100%                                    |
| F2 ×6          | `explainError` against `F2_kunci-jawaban.csv`                                                                                                          | 6/6; sources on 1–5                     |
| F3-1 BPMN      | Import plus gateway unit tests; slot extraction on the sentence plus 2 extra questions                                                                 | 3/3                                     |
| F3-2 SOP       | `answerGrounded` with page and point check; cuti melahirkan gives not-in-guide                                                                         | 5/5                                     |
| F3-3 recording | `compileProcedure` against the expected JSON (10 steps, 4 parameters)                                                                                  | exact match                             |
| Abstention set | 25 questions (§4.3)                                                                                                                                    | recall 100%, precision ≥90%             |
| Speech         | 5 clips from a 45+ speaker: WER; P50/P90 time to first audio                                                                                           | ≤ 4 s at P90                            |
| Safety         | Denied-target, password-request and "salah" validators over all outputs                                                                                | 0 violations                            |

---

## 13. ADRs (AI)

Written with the code:

1. **ADR-0009:** grade photos need two agreeing readers before a cell is accepted.
2. **ADR-0010:** BPMN processes are walked in code; the model only fills slots. Supersedes ADR-0006's "no BPMN runtime" for the school workspace.
3. **ADR-0011:** photo jobs live in R2, and the laptop polls for them.
4. **ADR-0012:** speech is transcribed as its own step, and TTS goes through OpenRouter.

The partner owns the ADR for the desktop shell and extension bridge (Appendix A).

---

## 14. Day-0 spikes (AI)

| #   | Spike                                                                                                                                                | Pass condition                                     | If it fails                                                                             |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | --------------------------------------------------------------------------------------- |
| S1  | Vision bake-off on F1-1: Hydrogen, Terra, 3.7 Flash, Haiku 5.5                                                                                       | Per-model cell accuracy, flags and $/page recorded | Choose the pipeline from the numbers; single reader with wider flags as the last resort |
| S2  | Speech: 5 casual clips; mai-transcribe-2 vs whisper-turbo vs Gemini audio (billing unit and per-request minimum); MAI-Voice `id-ID` at `speed: 0.85` | Acceptable WER; P90 ≤ 4 s                          | Gemini single-hop audio; then the local voice                                           |
| S3  | Ask Javan for a real BPMN export                                                                                                                     | —                                                  | Author the F3-1 BPMN in Camunda Modeler                                                 |
| S4  | OpenRouter: does `media_resolution` pass through for Gemini? Can the cheaper flex tiers be selected?                                                 | Known yes/no                                       | Assume default image resolution and list prices                                         |
| S5  | UIA from Electron: a persistent PowerShell host reads an error banner in Chrome and a native dialog                                                  | Text returned in < 300 ms after warm-up            | Extension `getPageText()` for web apps, screenshot plus vision for the rest             |
| S6  | `alchemy dev`: the `INBOX` R2 binding works locally; a 40 s `inboxProcess` request completes                                                         | Job reaches `ready`; objects deleted on ack        | Keep processing in the request; raise the client timeout                                |

---

## 15. AI plan (Zahra)

| When   | Work                                                                                                                                                                                                                                               | Depends on partner for                                                                               |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Wed pm | Spikes S1, S2, S4, S6. Extend the eval harness (F1-1, F1-2, F2, F3-2, abstention). Contracts in `packages/contracts` for §2.1 and the `inbox` procedures.                                                                                          | Agreeing the §2 contract and the `enqueue` call                                                      |
| Thu am | `readGradePhoto` (two readers, checks, re-read), `matchNames`, `applySchoolRules`, `buildVerificationQuestions`, `parseGradeExcel`. The R2 photo inbox and the `grades` module.                                                                    | Roster and profile shape                                                                             |
| Thu pm | `screen-reader` module (S5, capture at F8 down, UIA and extension text, password guard). `explainError` plus the `help` module. `answerGrounded` with quote verification. Command routing. `transcribe` and `synthesize` plus the `speech` module. | F8 key-down event and window handle from the shell; `getPageText()` from the extension; audio format |
| Fri am | `importBpmn`, `planBpmnStep`, `compileProcedure` plus the `procedures` and `knowledge` changes. `diffReadback`, `guidedLine`.                                                                                                                      | Recorder event format; Rekap Nilai scrape format                                                     |
| Fri pm | Evals to green, cost and latency report, prompt and validator fixes; join the end-to-end runs                                                                                                                                                      | Working end-to-end paths                                                                             |

---

## Appendix A: Handoff notes for the fullstack side (not AI scope)

Research findings from 25 Nov 2026, offered to our partner. They decide.

### A.1 Shape

```
 Teacher phone ──WhatsApp──▶ Meta Cloud API ──webhook [SE]──┐   ┌── QR upload page [SE]
                                                             ▼   ▼
   Nemu Service (Worker): inbox DO + R2 inbox [AI] · grades/help/knowledge/procedures/speech [AI] · auth [SE]
                                   │                                     └──▶ packages/ai [AI] ──▶ OpenRouter
                                   ▲ HTTPS + WebSocket
   Nemu Desktop (Electron) [SE]: overlay dot + bubble, F8, mic UI, input watch, WhatsApp hand-off
                                 └─ screen-reader module [AI]: capture, UIA, password guard
                                   ▲ ws://127.0.0.1 (pairing token + Origin check)
   Nemu Extension (Chrome MV3) [SE]: locate, paced fill, highlight, read back, record, guard, getPageText()
```

### A.2 Desktop shell

**Electron 45.** Overlay:

- one `BrowserWindow` per display at `display.bounds`;
- `transparent`, `focusable:false`, `alwaysOnTop('screen-saver')`;
- `setIgnoreMouseEvents(true,{forward:true})`;
- `setContentProtection(true)` keeps the overlay out of its own screenshots.

Copy tekram/clicky-windows' overlay recipe (MIT) rather than forking either clicky-windows.

Other pieces:

- **Hotkey and input watch:** F8 down and up plus "teacher touched input" via `uiohook-napi` (it can't tell injected input from real input, so fill through the extension, not OS input).
- **Screen reading:** screenshot, UIA and the password guard are **AI scope**, in §5.1. The shell only hosts the `screen-reader` module and passes it the F8 key-down event and the window handle.
- **Rejected:**
  - Tauri v2: no click-through forward option, and it needs Rust.
  - Native C#: it rewrites the UI.
  - CDP into the teacher's Chrome: blocked on the default profile since Chrome 136.

### A.3 Platform portability (Windows now, macOS later)

Electron and the Chrome extension both run on Windows and macOS. Most of the code is shared; keep the OS-specific pieces behind small adapters.

| Piece                                                                        | Windows                       | macOS                                                                               | Shared?                                                   |
| ---------------------------------------------------------------------------- | ----------------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Overlay window (transparent, click-through with forward, content protection) | Electron                      | Electron (forward and content protection work on Mac too)                           | ✅                                                        |
| Bubble, verification, voice UI (React + `@nemu/ui`)                          | —                             | —                                                                                   | ✅                                                        |
| Fill, highlight, read-back, recorder in web apps                             | Extension                     | Extension                                                                           | ✅                                                        |
| Input watch (`uiohook-napi`)                                                 | works                         | works after the user grants **Accessibility** permission                            | ✅ + permission screen                                    |
| Screenshot (`desktopCapturer`)                                               | works                         | needs **Screen Recording** permission; macOS asks again periodically                | ✅ + permission screen                                    |
| Hotkey F8                                                                    | F8                            | F-keys default to brightness and volume: fn+F8 or another key                       | ⚠️ configurable key                                       |
| Read native-app text (F2)                                                    | Windows UI Automation         | macOS Accessibility API (`AXUIElement`), different code                             | ❌ adapter; the screenshot-plus-vision path works on both |
| Local fallback voice                                                         | Microsoft Andika (id-ID)      | Damayanti (id-ID)                                                                   | ✅ same browser speech API                                |
| WhatsApp hand-off                                                            | `whatsapp://send` + clipboard | same link; the Mac app is a different build                                         | ⚠️ test separately                                        |
| Installer                                                                    | NSIS (`electron-builder`)     | DMG, **signed and notarized** (Apple Developer, US$99/year) or Gatekeeper blocks it | ⚠️ cost and setup                                         |

Adapters to define once:

- `ScreenReader` (UIA, AX, or vision);
- `Permissions` (no-op on Windows; Accessibility and Screen Recording on Mac);
- `Hotkey` (configurable key);
- `Installer`.

The PRD keeps Mac out of MVP scope and the users are on Windows 10, so **build and test on Windows only for Friday**. Keeping the code portable costs almost nothing.

### A.4 Extension changes

- Locate by role and accessible name, then label, `name`, placeholder, then table row × column. AlurSekolah won't carry `data-nemu-id`.
- Allowlist the AlurSekolah mock origin (keep `activeTab`, ADR-0004).
- Paced fill: 60–100 ms per character, 500–800 ms between fields. Treat any trusted (`isTrusted`) pointer or key event as "teacher touched".
- Rekap Nilai scrape after Simpan.
- Recorder that captures locators, values and crops.
- `bpmn-js` NavigatedViewer with `canvas.addMarker(taskId)`. Keep the bpmn.io watermark, which its license requires.

### A.5 Executor guardrail

- **Verb allowlist** (`point`, `setValue`, `selectOption`, `check`, `scroll`, allowlisted `navigate`), with no generic click on form controls.
- **Name deny list:** `simpan, kirim, ajukan, hapus, submit, save, send, delete, setujui, tolak, selesaikan, finalisasi, kunci, publish, unggah, upload, bayar, ya, ok, konfirmasi, keluar, logout`.
- **Structural blocks:**
  - never `form.submit()`, `requestSubmit()` or Enter;
  - a capture-phase listener cancels any submit with `isTrusted === false`;
  - UIA `InvokePattern` is refused.

### A.6 WhatsApp intake, WhatsApp hand-off, login

- **WhatsApp Cloud API test number** (up to 5 verified phones; about 4–8 hours to set up). Inbound messages are free.
  - **Don't reply in WhatsApp:** beyond 1.000 free service messages per number per month, each reply costs about Rp357.
  - Webhook: answer GET `hub.challenge`, verify `X-Hub-Signature-256`, drop unknown senders before download.
  - Call our `teacherForSender` before downloading, then `enqueuePhoto({teacherId, source: "whatsapp", bytes, messageId})` (snippet in `docs/school-ai.md`).
- **QR upload page** as the fallback; it calls `enqueue` with the bytes.
- Reject Baileys and whatsapp-web.js (Terms violations, bans, a malware fork).
- **Hand-off (F2-05):**
  - Open our `waDraft` with `whatsapp://send?phone=…&text=…`.
  - Put our screenshot on the clipboard and say "tekan Ctrl+V lalu Kirim".
  - Fallback: `web.whatsapp.com/send`.
  - Never send Enter.
- **Login:** the teacher's own Chrome session, plus a signed identity token from the mock. Never type the password, read cookies, or forward the AlurSekolah cookie.

### A.7 Their spikes

- WhatsApp test-number webhook.
- `whatsapp://send` and image paste on the current WhatsApp Desktop (WebView2 build); fallback `web.whatsapp.com/send` plus "tekan Ctrl+V lalu Kirim".
- Overlay click-through at 125% DPI on two displays.

**Fallback if the shell slips by Thursday noon:** extension-only on Chrome.

---

## Sources (fetched 25 Nov 2026 unless dated)

- OpenRouter model and endpoint APIs (`/api/v1/models`, `/endpoints`, `/endpoints/zdr`); ZDR https://openrouter.ai/docs/guides/features/zdr ; structured outputs https://openrouter.ai/docs/guides/features/structured-outputs ; speech-to-text https://openrouter.ai/docs/api/api-reference/stt/create-transcription
- Roboflow OCR leaderboard (2026-11-19) https://playground.roboflow.com/leaderboard/ocr ; IDP Leaderboard v1.5 (2026-03-11) https://trailhq.com/blog/idp-leaderboard-1-5 ; WildHandBench arXiv 2608.22959 ; "Beyond Logprobs" arXiv 2606.24420 ; AbstentionBench arXiv 2506.09038
- bpmn-io: bpmn-moddle, bpmn-js, camunda-bpmn-moddle, feelin (GitHub); AlurKerja Camunda 7 fork https://alurkerja.com/camunda-7-fork
- SheetJS https://cdn.sheetjs.com ; talisman, fuzzball, munkres (npm)
- Azure Speech pricing https://azure.microsoft.com/en-us/pricing/details/cognitive-services/speech-services/ ; Silero VAD https://github.com/snakers4/silero-vad ; edge-tts https://github.com/rany2/edge-tts
- PP 33/2026 summaries: katadata (2026-09-03), SIP Law Firm, RSM client alert, bisnis.com (2026-10-28)
- Handoff (Appendix A): Electron BrowserWindow https://www.electronjs.org/docs/latest/api/browser-window ; Chrome UIA (2025-08-14) https://developer.chrome.com/blog/windows-uia-support-update ; Chrome remote-debugging change https://developer.chrome.com/blog/remote-debugging-port ; Meta WhatsApp pricing and media docs https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing ; Cloudflare Durable Objects WebSockets https://developers.cloudflare.com/durable-objects/best-practices/websockets/ ; clicky-windows https://github.com/tekram/clicky-windows
