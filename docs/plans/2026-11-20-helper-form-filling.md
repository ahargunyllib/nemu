# Plan: Nemu for staff who fill forms for others

## Goal

Staff who enter data for citizens, parents, or customers fill an AlurKerja form from a source document (paper form, letter, KTP, chat message) in one pass. Nemu reads the source, proposes each value with where it came from, and the staff member confirms with **Isi**.

## Why this, not parents

- Parents who cannot read already rely on helpers. The helper does the typing, at volume, and works
  for an organisation that can pay.
- It fits Nemu as built: an employee guide inside AlurKerja, on desktop Chrome, with Action Levels.
- No ADR changes: `fill` stays at Konfirmasi (ADR-0003, ADR-0005).

## Desk research (20 November 2026)

Sources are local journals, regional news, Ombudsman and PANRB pages, and vendor blogs (biased). No
social media posts surfaced. None give minutes per form, so Phase 0 still has to measure.

**Complaint intake: supported.**

- Entering manual complaints into SP4N-LAPOR! is a formal duty (Permenpan 62/2018).
- Complaints arriving by WhatsApp are copied into an agenda book, then typed into the web system.
- Manual recording delays handling and leaves complaints undocumented.
- Ombudsman (2023) reports vacant admin posts and no handover when staff rotate, so new staff often
  start cold.
- The usual proposed fix is a WhatsApp gateway that only captures messages. Nemu's edge has to be
  structuring free text into the form, picking the category and agency by SOP, and guiding new
  staff, not capture.

**School administration: partly supported, but a different task.**

- The biggest reported time drain is typing the same student data into several systems (buku
  induk, Excel, payments, Dapodik, EMIS), plus sync failures with central servers.
- Paper-to-system retyping happens during enrolment (unclear handwriting, overloaded counters), but
  the common fix is online registration, and Dapodik already pulls existing student data.
- Most of those systems are government apps, not AlurKerja, and Nemu cannot fix server sync.
  Lower priority unless the target is AlurSekolah itself.

**What it changes:**

- Pengaduan stays the first candidate.
- Its default is guide first, then automate: staff turnover makes teaching the process as valuable
  as speed.
- Phase 0 must ask whether intake staff already have a WhatsApp gateway and what is still typed by
  hand after it.

## Why Nemu, not a general assistant

A general assistant already turns a pasted complaint into structured fields. Nemu has to win on
everything around that step.

|                       | Prompting Claude                                   | Hermes-like agent                   | Nemu                                                     |
| --------------------- | -------------------------------------------------- | ----------------------------------- | -------------------------------------------------------- |
| Where the work happens | Separate chat; staff copy each field back         | Drives the browser itself           | Inside the AlurKerja form, filling fields with **Isi**   |
| Agency rules          | Whatever each staff member pastes in               | Its own memory, not agency-checked  | Admin-managed SOP, categories, routing, with citations   |
| Wrong click or submit | Cannot act                                         | Can click anything                  | Extension refuses submit (ADR-0002), tab-only access (ADR-0004) |
| Citizen data          | In a consumer app the agency doesn't control (UU PDP) | In an agent's long-term memory on a server | Under the organisation's control, audit in the Chat Log, no stored images |
| Staff turnover        | Each hire learns to prompt                         | Each hire sets it up                | Knowledge stays in the system; the Guide teaches new staff |
| Cost per form         | Per-seat subscription                              | Rp13,000–75,000 + server and browser | Rp500–1,200                                              |

Nemu is the layer that makes a model safe inside an agency's workflow; the model underneath is
swappable (`gpt-6.1-sol` via OpenRouter today).

The argument fails if:

- Nemu is not inside the real AlurKerja (needs Javan); then it is a worse chat window.
- Nobody maintains the agency's knowledge.
- The task is only summarising text; a free chat assistant is enough there.

Pitch to Javan: "Your clients' staff are already pasting citizen data into ChatGPT or Claude. Nemu
gives them the same help inside AlurKerja, following the agency's own rules, with an audit trail
and no data leaving the agency's control." The "already pasting" claim is unverified; Phase 0 tests
it.

## Automate or guide

Not one choice for the product: the default depends on the user and how often they do the task.

| User                                         | Frequency          | Cost of a mistake    | Default                                    |
| -------------------------------------------- | ------------------ | -------------------- | ------------------------------------------ |
| Staff retyping forms (TU, intake officer)    | Daily, many times  | Medium, reviewed     | Automate: Nemu fills, staff checks         |
| Employee on a rare process (Perjalanan Dinas) | A few times a year | High                 | Guide: show the step, explain why          |
| Employee new to a frequent process           | Often, new to them | High at first        | Guide first, then do more as they learn    |

Combining both means Nemu does more as the user gets familiar, with no mode switch. Action Levels
(Arahkan, Konfirmasi, Jalan sendiri) already span guide to automate.

Principles:

- One person, one moment, one job, e.g. the TU staff member entering 200 enrolment forms in July.
- The right behaviour is the default; no "teach me / do it for me" toggle.
- Say no to every segment beyond the first until it works.

## Discovery

Test two candidates side by side:

1. **School administration (AlurSekolah)**: staff entering student and parent data from paper.
2. **Government complaint intake (Pengaduan)**: officers turning letters and WhatsApp messages into
   the complaint form.

For each, answer:

- **Is the pain real?** Forms per day, minutes per form, Revisi rate. From AlurKerja data via Javan,
  not opinions.
- **Automate or guide?** Ask: "If this form filled itself, would you check it or trust it?" Check
  means automate with review; hesitation means guide.
- **Who pays?** Who feels the cost of slow or wrong entry: staff, manager, or agency.

Staff interview questions:

- "Show me the last form you filled. Where did the data come from?"
- "What slows you down or goes wrong most often?"
- "When did a mistake cost you something?"
- "Who checks your work?"
- "Do you ever paste a complaint into ChatGPT, Claude, or another AI tool? What for?"

Kill rule: if neither candidate shows frequent, costly work that a manager wants fixed, stop and look
elsewhere.

## Partner fit: PT Javan Cipta Solusi

- Javan builds AlurKerja, the platform the Demo App imitates.
- AlurKerja renders forms from its own workflow config, so Javan could emit stable `nemu_id`s on
  real tenants instead of Nemu guessing at third-party DOM.
- AlurKerja already tracks task status, SLAs, and bottlenecks, so Javan can show which forms cost
  staff the most time or get sent back for Revisi.
- Candidate processes from Javan's own products:

| Candidate                      | Helper                 | Source document                       |
| ------------------------------ | ---------------------- | ------------------------------------- |
| Public Complaints (Pengaduan)  | Intake officer         | Letter, WhatsApp message, walk-in note |
| AlurSekolah                    | School admin, treasurer | Paper enrolment form, KK, payment slip |
| Government service back office | Front-office officer   | Paper application, KTP, KK            |

Public Complaints has the strongest fit: citizens arrive by many channels and every complaint is
retyped into one structured form.

## Flow

1. Staff opens the AlurKerja form and attaches the source (photo, PDF, or pasted text).
2. Nemu extracts the values deterministically where it can (NIK, dates, amounts) and by model only
   for free text.
3. Nemu shows one **Isi** action per field, each citing the part of the source it came from.
4. Fields with no value are labelled for the staff member to fill.
5. Staff confirms and submits. Nemu never submits.

## What to build

| Piece                         | Status                                                              |
| ----------------------------- | ------------------------------------------------------------------- |
| `fill` at Konfirmasi, **Isi** | Have                                                                |
| Image input                   | Have (Area Crop sends an image to `gpt-6.1-sol`)                    |
| Knowledge Workspace per case  | Have the seam (ADR-0006); new `W-PENGADUAN` or `W-SEKOLAH`          |
| Document upload as source     | New: whole page or PDF, not only an Area Crop                       |
| Many **Isi** actions per answer | Check the extension; likely new                                   |
| Source citation per value     | New: cite a region of the uploaded document                         |
| Real AlurKerja tenant         | New: out of MVP scope today; needs Javan to emit `nemu_id`s         |

## Models

| Role                         | Model                                  | Status |
| ---------------------------- | -------------------------------------- | ------ |
| Answer, field mapping        | `gpt-6.1-sol`                          | Have   |
| Safety, injection            | `jev-1.13`                             | Have   |
| Read documents               | `gpt-6.1-sol` vision first; dedicated OCR only if KK tables fail | Test |

No voice models: helpers can read.

## Cost

Estimates, not measurements: the repo logs no token usage yet.

Prices (OpenRouter, 20 November 2026): `gpt-6.1-sol` costs $2 per million input tokens, $10 per
million output tokens, and $0.10 per million cached input tokens. `jev-1.13` is not in OpenRouter's
public model list (only `typesafe/jev-router`, priced per route), so its price is unknown and left
out below; it is a small classifier and should not change the totals much. Rupiah at Rp16,500 per
dollar.

Assumed tokens per `gpt-6.1-sol` call, from `packages/ai/src/openai.ts`:

| Call                             | Input                                                        | Output | Cost         |
| -------------------------------- | ------------------------------------------------------------ | ------ | ------------ |
| Answer call (today)              | 3–6k: system prompt, answer schema, evidence, Element List   | 0.5–2k | $0.01–0.03   |
| Extraction call with a document  | 6–9k: the above plus a page image                            | 1–2k   | $0.02–0.04   |
| Agent step with a screenshot     | 20–40k: screenshot plus growing history                      | 0.3–1k | $0.04–0.09   |

Per form (about 20 fields):

| Option                                      | Calls                                              | Per form     | Rupiah           | vs. today |
| ------------------------------------------- | -------------------------------------------------- | ------------ | ---------------- | --------- |
| Today: one Perjalanan Dinas                 | 5–10 answer calls                                  | $0.05–0.30   | Rp800–5,000      | 1x        |
| **This plan: helper fills from a document** | 1 extraction call, 1 answer call                   | **$0.03–0.07** | **Rp500–1,200** | ~0.3–0.5x |
| Dropped: direct fill for parents            | 10–20 answer calls, OCR, voice (voice not priced)  | $0.10–0.60 + voice | Rp1,700–10,000 + voice | ~2x |
| Screenshot-per-step agent (Hermes-like)     | 20–50 agent steps, plus cloud browser fees         | $0.80–4.50 + browser | Rp13,000–75,000 + browser | ~10–25x |

Per month for this plan:

| Customer                                  | Forms per month | Cost                      |
| ----------------------------------------- | --------------- | ------------------------- |
| One school TU in enrolment month          | 200             | $6–14 (Rp100,000–230,000)   |
| One agency's complaint intake             | 1,000           | $30–70 (Rp500,000–1,150,000) |

Levers: cache the static system prompt and answer schema (cached input is 20x cheaper), keep the
Element List to form fields, and send document images at the lowest detail that still reads a KK.

The organisation pays, so track cost per completed form. Before building, log OpenRouter `usage` to
the Chat Log to replace these estimates.

## Phases

0. **Discovery**: run the Discovery section with Javan on 2–3 tenants and 5–10 staff per
   candidate. Pick one candidate or stop.
1. **Demo**: the chosen process in the Demo App with fixtures, end to end.
2. **Pilot**: one real tenant with Javan emitting `nemu_id`s, measured against the Phase 0 baseline.
3. **Expand**: the next process from the table, reusing the same seams.

## Risks

- Demand still unproven; Phase 0 can kill the plan.
- A wrong value confirmed without a look. Mitigated by per-field citations.
- Identity data in source documents: never store the image (as the Chat Log does today), and check
  UU PDP 27/2022.
- Real-tenant access depends on Javan.
