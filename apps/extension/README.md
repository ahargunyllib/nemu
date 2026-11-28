# Nemu Extension

The Chrome and Edge extension teachers use on AlurSekolah, Moodle and government portals. On the
school's allowed websites it shows the Nemu button at the bottom right; a typed question goes to
the Nemu Service and the answer comes back as a Gelembung Jawab.

- **One MV3 build** for Chrome and Edge (`pnpm --filter extension build`, or `build:edge` for an
  Edge-named output). Both load it unpacked.
- **Install code (ADR-0015).** The toolbar icon opens the settings page, where the school operator
  enters the school's install code once. The demo school, SDIT Nusantara, uses `NEMU-SDITN-2026`.
  The Nemu Service refuses extension requests without a known code.
- **Identity without login (ADR-0015).** Nemu reads the email of the account signed in on the
  AlurSekolah page and sends it with every request; the Nemu Service matches it against the
  school's Teachers & contacts (WS-06). An unregistered account gets "Akun ini belum didaftarkan.
  Hubungi Pak Rizal." (the school's own operator). The page is read again whenever it changes, so
  signing in as someone else switches who Nemu helps. Sites without an AlurSekolah account (Ruang
  GTK, Moodle) ask as the last account seen on AlurSekolah.
- **Email readers.** `features/identity/lib/page-email-readers.ts` has one reader per site: the
  mock AlurSekolah reads `#menu-email` / `#profil-email`. **The reader for Javan's AlurSekolah
  tenant is a placeholder**: it takes the first email in the page's header or account area until
  the tenant's markup is known. Replace it with the tenant's own selectors.
- **Permissions and WS-03 (ADR-0016).** `host_permissions` cover `*.alursekolah.id`, the mock
  AlurSekolah and Ruang GTK, the Moodle test site, `web.whatsapp.com`, `http://localhost/*`,
  `https://localhost/*` (the Moodle test site run locally from `infra/`) and the Nemu Service. Inside them, the school's WS-03 list from the Nemu Service (`extensionConfig`)
  decides: the content script asks the background first and, off the list, shows and reads
  nothing (e-Rapor is off it on purpose: test WS-1 (a)). The list is read again at most once a
  minute, so a change needs no update. A site the school adds outside the known ones shows
  **Izinkan** on the settings page, which asks Chrome for it (`optional_host_permissions`); the
  background then runs the content script there too.
- **Answers.** The background sends the question to `helpRoute`. Questions about school rules go to
  `helpAsk`, "ini kenapa?" to `helpExplain` with the page's visible text (never input values, and
  nothing while a password field shows), and "berhenti" closes the bubble. When the question matches
  a symptom of an uploaded BPMN (F2-08), Sumber lists the process steps with **Lihat diagram** (the
  Admin Workspace at `WXT_ADMIN_URL`, default `http://localhost:3002`), and the one button opens a
  reply to the parent in WhatsApp Web. A source cited from a PDF is a link in the Sumber list: the
  background asks the Nemu Service for a short-lived signed link (`documentFileLink`, ADR-0018)
  and opens the PDF at the cited page (`#page=`) in a new tab next to the teacher's
  (`verify:sumber`). Grade entry and
  processes say they aren't available yet, until F1 (#207) and F3 (#213) hand their step lists to
  the executor.
- **Talking (#200).** Hold **Ctrl + Spasi** on an allowed page, or press and hold the Nemu button,
  and speak: Nemu shows a red dot and "Nemu mendengar…". On release the recording goes to
  `speechTranscribe` as 16 kHz mono WAV, the heard text shows in a small bubble, and then it goes
  to `helpRoute` like a typed question. The content script records on the site itself, so each
  school site asks for the microphone once (ADR-0019): on the first hold, Nemu's cursor and a
  Gelembung Tunjuk point at Izinkan in Chrome's prompt; a blocked microphone gets a Kartu Info
  with three steps to allow it again; words too unclear to act on show as "Nemu menangkap: “…”.
  Bisa diulang, Bu?" and nothing is done with them (#268). Holds under 300 ms send nothing;
  recordings stop at 15 s. The combination is the school's WS-08 setting,
  read with the WS-03 list (`extensionConfig.settings.talkShortcut`); a page picks it up on its
  next load, and Ctrl + Spasi stands in when the school has none.
- **Site permission and settings (#212).** The background answers `nemu:site-access` with the
  page's WS-03 permission (baca dan isi · siapkan pesan · baca saja; the narrower wins where two
  sites cover a page) and the school's WS-08 settings (talk combination, default cara, fill
  speed). `NemuApp` takes the talk combination from it; the executor reads the same config
  through `executorSettings` (below).
- **Nemu's voice (#200).** Nemu speaks the first sentence of every answer through
  `speechSynthesize`, and the Gelembung Jawab marks the word being spoken. Estimated timings are
  rescaled to the real audio length. When the service sends no audio (the fixture responder, or no
  TTS model), or the page refuses to play it, the local `id-ID` voice speaks at 0.85×. Clicking the text, or saying
  "ulangi", repeats it; opening **Kenapa?** or **Sumber** reads that text aloud.
- **Short commands (F0-15).** Holding the combination while Nemu speaks or works pauses it and
  listens for "pelan", "ulangi", "ajari saya", "lanjut" or "berhenti". They go out on
  `voiceCommands` (`features/voice/stores/voice-commands.ts`) as `pause`, then one `command` or
  `resume`. Nemu's voice handles them already; the executor (#202) subscribes there and calls
  `voiceCommands.setWorking(true)` while it runs steps. While only the voice was speaking, anything
  that isn't a short command is a new question.
- **Display types (#201).** Everything Nemu shows is one of the five display types from
  `@nemu/ui/nemu/*`, one at a time (`docs/design-system.md`). An answer is a Gelembung Jawab
  whose sources sit behind its **Sumber** link. In a dev build, `?pratinjau-nemu` on an allowed
  page (`http://localhost:3003/?pratinjau-nemu#/nilai`) adds a dock at the bottom left that shows
  all five and moves the Nemu cursor between two fields, without the AI.
- **The executor (#202).** Every task Nemu does on a page (grade entries, BPMN steps, recordings,
  Moodle setup) is one step list from `@nemu/contracts/executor`, handed to `executor.start` in
  `features/executor/stores/executor.ts`. The verbs are `point`, `setValue`, `selectOption`,
  `check`, `scroll` and `clickMenu`; targets are found by label, role, text or table row and
  column, never by position, and a missing or ambiguous one stops Nemu, which asks (F0-06).
  - **Cara 1** fills at about one field per second, typing digits one by one, ticking each row and
    reading the first two aloud; **Pelan** halves the speed; it stops before Simpan and points at
    it. **Cara 2** points, says the value and checks what the teacher typed. **Cara 3** waits for
    Simpan and then checks every value. "Ajari saya" switches to cara 2 at any time (F0-11). The
    default cara and the cara 1 fill speed are the school's WS-08 settings (pelan 2 s, normal 1 s,
    cepat 0.5 s per field), read by `executorSettings` (`lib/executor-settings.ts`) from the
    config the background last fetched.
  - **Site permission (WS-03).** `executorSettings` also gives the page's permission, and
    `sitePermits` (`lib/safety.ts`) decides each acting step: on a _baca saja_ site Nemu fills and
    clicks nothing, and on _siapkan pesan_ it only types the message. A step the site doesn't permit
    becomes the teacher's, as in cara 2 (Nemu points and says it), and is logged as `refused`.
  - **Visible navigation (F0-13).** Nemu reaches the task page by clicking menus with the Nemu
    cursor while naming them, never by opening a URL. The run is kept per tab in
    `chrome.storage.session` (through the background), so it carries on after a page load.
  - **Safety, in the extension (F0-07, F0-08).** A real mouse press or key while Nemu acts stops it
    and asks: Saya isi sendiri / Nemu lanjut / Berhenti. `isDeniedActionName` runs on every target:
    Simpan, Kirim, Hapus and the like are pointed at, never pressed, whatever verb asked for it, and
    so is anything that would submit a form. Any verb outside the six becomes pointing. Nemu
    dispatches no key, so never Enter, and cancels every submit while it acts (untrusted ones for
    the whole task).
  - **F0-09.** Steps that come in parts (`registerStepSource`) are retried twice with a plain
    message, then Nemu stops at a safe step with the inputs kept; "lanjut" or **Lanjut** resumes.
  - **Catatan langkah (F0-14)** ends each task and reopens from the Nemu button (**Lihat catatan
    langkah**); "Lain kali coba sendiri" starts that kind of task in cara 2 next time.
  - **Action log (WS-10).** Every action goes to `actionLogRecord` as who, when, website, task,
    action, target, cara and result, never a value.
  - **Finishers.** A flow that has more to do once its task ends registers
    `executor.registerFinisher(kind, …)`; it gets the notes so far and shows Catatan langkah itself
    with `executor.presentNotes`. F1 uses it to read the grades back after Simpan.
  - **Dev tools.** In a dev build, an allowed page opened with `?uji-nemu`
    (`http://localhost:3003/?uji-nemu#/beranda`) shows a dock: **Muat respons uji** runs
    `F0-1_respons-ai-palsu.json` (three fake AI responses that try to press; it passes when Nemu
    points every time and nothing is pressed), **Pilih berkas…** runs another file of the same
    shape, **Contoh cara 1/2/3** fill a sample grade list, and **Koneksi putus** shows F0-09.
- **F1: grade-book photo from WhatsApp (#207).** `features/grade-photo/`. The visible allowed tab
  polls `inboxJobs` every 4 s through the background, which claims each photo for one tab (a
  12 s lease its polling renews, held once the teacher starts), so the small Kartu Pilih **Foto
  dari WhatsApp · Mulai / Nanti** shows above the Nemu button in one tab only.
  - **Mulai** asks what the grades are; the answer, typed in the type box or spoken, goes to
    `gradesParseCommand` until the class, subject and assessment are known. "masukkan nilai …"
    asked from the panel (helpRoute `input_nilai`) starts the same flow, and asks for the photo
    over WhatsApp when none is waiting. Then `inboxProcess` reads it (Gelembung Kerja meanwhile).
  - **W5.** One Kartu Pilih per question with the cell cropped from `inboxPhoto` in the background
    (only the crops reach the page), the readings as big buttons, nothing pre-selected, **Angka
    lain** on every digit and S/I/A question (then the number is typed or said), **Tidak ada di
    daftar** on names. Holding the talk combination answers too: "delapan puluh enam", "86",
    "kosongkan", a name on the card.
  - `gradesFinalize`'s entries become one cara 1 task (`lib/grade-task.ts`): the Nilai menu,
    Kelas, Mata Pelajaran and Jenis Penilaian (UH, tugas and PR are **Harian**), Tampilkan Siswa,
    then each student's **Nilai** found by the row's name and the column header, **Catatan**
    "remedial" below KKM and "tidak hadir" for S/I/A (value left blank). It ends pointing at
    Simpan: "Silakan Ibu tekan Simpan.", with every value behind **Lihat ringkasan**.
  - **After Simpan** Nemu waits for the page's saved message (or **Sudah tersimpan**), reads the
    grades back with `gradesReadbackAlurSekolah` (or, when WS-07 isn't connected, compares what
    the page shows with `gradesReadback`), says the result in one sentence, calls `inboxAck` and
    offers Catatan langkah. The wait survives a page load.
  - **Nanti** hides the card in this tab; × or Berhenti before the fill lets the photo show again.
- **F4-1: check a Moodle quiz the way students see it (#209).** `features/quiz-check/`. "Nemu,
  tolong cek kuis ini" (typed or spoken, on any page of a quiz) is the extension's own command; no
  route is asked for. One executor task (`lib/quiz-task.ts`, step source per page) opens
  **Setelan** (open and close times), **Soal** (each slot, the maximum grade, and each question's
  key, read from its edit form by address without saving anything) and **Kuis**, then points at
  **Pratinjau kuis**, which the teacher presses (it sends a form, F0-08). On the preview it reads
  this page's questions and images as shown and the other pages by address. Every step is a menu
  click or a point, so nothing on the quiz changes.
  - **DOM rules** (`lib/quiz-rules.ts`): images that don't load, questions whose answers all grade
    0, question count (none, students seeing a different number, or not the number she said),
    class (the quiz's name or her words against the course) and times (closing before it opens,
    or already closed). Moodle markup is read in `lib/moodle-pages.ts` (Moodle 5.3, Indonesian or
    English labels).
  - **Judgement (#218).** The extension sends what it read to `quizJudge`, which asks
    `SchoolAi.judgeQuiz`. No model checks exist yet, so it adds nothing; without the service the
    rules still stand.
  - **Pointing.** One Gelembung Jawab per problem, pointed at on the preview: the missing image or
    the answers when the question is on this page, else its button in Navigasi kuis, with
    **Berikutnya**. The list survives a page load, so opening soal 15 from Navigasi kuis moves the
    pointer to its image. After the last problem one more Gelembung Jawab, about no element, says
    the closing sentence (#256), built in code from the count with no model call:
    "Selain dua hal itu, kuisnya sudah siap, Bu." (`closingSentence`). With no problems Nemu says
    only that the quiz is ready; a check stopped early, or problems closed with ×, get none. Its
    **Catatan langkah** lists every problem and "Nemu tidak mengubah apa pun di kuis ini."
- **F4-06: warn before deleting a quiz students took (#211).** `features/quiz-delete/`. "Tolong
  hapus latihan bahasa Inggris yang kemarin" (typed or spoken; "hapus"/"ganti" with "kuis",
  "latihan" or "ulangan") is the extension's own command. Nemu never presses Hapus.
  - **Which quiz** (`lib/pick-quiz.ts`): on the course page each quiz is scored on her words
    against its section and name, and a day she names ("kemarin", "hari ini") against the open
    and close dates the page shows. A quiz 2 points ahead of the next is picked; otherwise Kartu
    Pilih asks between the close ones (F4-3's decoy, on days it was open "kemarin" too). On a
    quiz's own page it is that quiz.
  - **Counting** (`lib/delete-task.ts`): one executor task opens the quiz and **Hasil** through the
    menus and reads the number of different students in the attempts table (or "Yang telah
    mengerjakan: N orang").
  - **Warning** (`lib/warning.ts`): Kartu Pilih beside that count, "Kuis ini sudah dikerjakan 3
    siswa. Kalau dihapus, nilainya ikut terhapus.", with **Jangan hapus** first and ⚠ **Tunjukkan
    tombol Hapus** under it. She can also answer by voice ("jangan", "tunjukkan").
  - **Jangan hapus** ends with Catatan langkah: the count, her choice, and "Nemu tidak menekan
    Hapus; Nemu hanya menunjuknya."
  - **Tunjukkan tombol Hapus** runs a second task: back to the course, **Mode Edit** on if it is
    off, the quiz's own **Edit** menu (`near` the quiz's name, since every activity's menu is
    called Edit), then a point at **Hapus**: "Kalau jadi dihapus, tekan Hapus sendiri, Bu." She
    presses it or not; Moodle then asks her to confirm. The executor refuses Hapus anyway (F0-08).
- **F4-03: put a quiz into Moodle from the teacher's script (#210).** `features/quiz-import/`.
  "Nemu, masukkan kuis dari naskah ini, buka Senin 7 Desember, tutup Kamis 10 Desember" on a
  Moodle course page is the extension's own command. She picks the script (PDF, Word or photo) with
  **Pilih naskah**; `quizScriptRead` (`SchoolAi.readQuizScript`, #219) reads it into a draft. Nemu
  never writes a question: each part the reading couldn't place (words, a key, a picture, the
  section) is asked on Kartu Pilih, or typed or said. A date she didn't say is asked; a clock time
  she didn't say becomes 00.00 (open) or 23.59 (close), and Nemu says so. **Masukkan ke Moodle**
  then runs one executor task in cara 1 (`lib/import-task.ts`, step source per page):
  - Mode Edit, the section's **Tambahkan konten** › Aktivitas atau sumber daya › Semua › Kuis ›
    Tambahkan; Nama, Waktu Pengerjaan and both dates (targets named by group, "Hari" in
    "Kuis dimulai"); Nemu points at **Simpan dan tampilkan**, which she presses.
  - The quiz's own **Bank soal** › Soal-soal › Impor: Format XML Moodle, Dapatkan kategori dari
    berkas unticked (so the questions land where Tambah › dari bank soal opens), and the XML
    handed to the picker as a drop (`dropFile`). If the picker doesn't show it within 10 s, the XML
    goes to Unduhan and Nemu points at **Pilih berkas …**. She presses **Impor**.
  - **Soal** › Tambah › dari bank soal › Pilih semua; she presses **Tambahkan soal terpilih pada
    kuis**. Every form submit is hers (F0-08); Nemu only opens menus, fills and ticks.
  - The F4-1 check then runs on the new quiz with the number of questions it should have; when it
    finds nothing Nemu says one sentence ("Kuis … sudah siap: 10 soal, dibuka … dan ditutup …"),
    and Catatan langkah holds the import's steps (with the drop) and the check's.
- **Contract.** Request and response schemas come from `@nemu/contracts/extension` and
  `@nemu/contracts/school`. Only the background calls the Nemu Service.

## Install the latest build

Every deploy from `main` rebuilds the extension against the production Nemu Service and replaces
the zip on the `extension-latest` release:
<https://github.com/ahargunyllib/nemu/releases/download/extension-latest/nemu-extension-chrome.zip>.
Unzip it and load the folder unpacked as below. To update, replace the folder's contents with the
new zip and click the reload icon on the extension card.

## Run it

1. Start everything with `NEMU_RESPONDER=fixture pnpm dev`: the Nemu Service on :3000, the mock
   AlurSekolah on :3003, Ruang GTK on :3004, e-Rapor on :3005, and the extension's dev build in
   `apps/extension/.output/chrome-mv3-dev`. The fixture responder answers offline, without
   `OPENROUTER_API_KEY` (`docs/school-ai.md`).
2. Load the extension unpacked: open `chrome://extensions` (or `edge://extensions`), turn on
   **Developer mode**, click **Load unpacked**, and pick `apps/extension/.output/chrome-mv3-dev`.
3. The welcome page opens on install. Press **Buka pengaturan Nemu**, enter `NEMU-SDITN-2026`
   and press **Simpan**.
4. Open <http://localhost:3003>, sign in as `siti.aminah` (password `nemu-uji-2026`), click the
   Nemu button, and ask "KKM nilai berapa?". Hold Ctrl + Spasi and speak to talk instead; the
   fixture responder always hears "masukkan nilai UTS Matematika 4B". The first hold makes Chrome
   ask for the microphone; press its top Izinkan, then hold again. Sign in as `rizal.operator`
   to see the unregistered message.

In dev the extension calls `http://localhost:3000`. Set `WXT_SERVER_URL` to point it at another
Nemu Service; the host permission follows it. `wxt build` and `wxt zip` fail without it, so a
production build never ships pointing at localhost:

```bash
WXT_SERVER_URL=https://nemu-api.ahargunyllib.dev pnpm --filter extension build
```

## Check it in a real browser

With `NEMU_RESPONDER=fixture pnpm dev` running, `pnpm --filter extension verify` builds the
extension against `http://localhost:3000`, loads it into Playwright's Chromium, and checks:

- the settings page refuses an unknown install code and keeps `NEMU-SDITN-2026`;
- the Nemu button and its hint show on the mock AlurSekolah;
- Bu Siti's "KKM nilai berapa?" comes back as a Gelembung Jawab whose Sumber link shows the SOP;
- the welcome page says how to talk and that Chrome asks for the microphone the first time;
- holding Ctrl + Spasi shows "Nemu mendengar…", then the heard text, then the answer with its
  spoken word highlighted; pressing and holding the Nemu button does the same;
- signing in as `rizal.operator` shows "Akun ini belum didaftarkan. Hubungi Pak Rizal.", and
  signing in as `dewi.lestari` brings the type box back;
- Ruang GTK shows the Nemu button and asks as the last AlurSekolah account;
- e-Rapor gets no Nemu button (WS-1 (a)).

Then, for #268, it opens a second, headed window without `--use-fake-ui-for-media-stream`, since
Chrome only shows its real microphone prompt there. Playwright can't press Chrome's buttons, so
the checks answer through the permission (CDP `Browser.setPermission`), as Izinkan, Jangan izinkan
or the site settings would:

- the first hold points the Nemu cursor just right of Chrome's prompt, level with Izinkan, with a
  Gelembung Tunjuk; allowing it says "Mikrofon sudah siap…";
- words the school AI caught as only "nilai" show "Nemu menangkap: “nilai”. Bisa diulang, Bu?"
  and nothing is done with them;
- refusing in the prompt (on Ruang GTK, a site Chrome hasn't asked about) shows the three steps;
- a blocked microphone shows the three steps with only Tutup, and talking works once it is
  allowed again.

`pnpm --filter extension verify:executor` does the same for the executor with a development
build: cara 1 from the Nilai menu to Simpan, Catatan langkah, the teacher's own click (F0-07),
a page load mid-task, F0-1 (3/3), F0-09 and cara 3, saving screenshots to `.output/verify-executor/`.

`pnpm --filter extension verify:f2-08` runs F2-1 end to end (#206, #217): Admin Javan connects
WS-07 to the mock, Pak Rizal uploads the official `packages/ai/src/school/fixtures/F2-1_alur-spp.bpmn`
as "Alur SPP" in Pengetahuan sekolah (once; later runs reuse it) and sees the suggested symptoms,
Aisyah's UTS grade (4A) is saved in the mock, and the three questions of
`F2-1_pertanyaan-dan-kunci.csv` are asked: the answer ("sudah tersimpan", the partly-paid branch,
paying in cash), Kenapa?, Sumber with 2–4 steps, **Lihat diagram** (bpmn-js in the Admin Workspace
with Lock Student Grades highlighted) and the parent reply in WhatsApp Web (no number, no amounts,
no "tunggakan"; answered locally, never sent). It also checks a student without grades and a
question no process covers. A local database that still has the synthetic "Alur Pembayaran SPP"
from before #217 should have it switched off first, or its symptoms compete with the official ones. `NEMU_ADMIN_URL` (default `http://localhost:3002/`) points it at another
Admin Workspace. Screenshots go to `.output/verify-f2-08/`.

`pnpm --filter extension verify:grade-photo` runs F1-1 end to end on the mock (#207). It needs
the stack started with `WA_BOT_SECRET` set as well (`NEMU_RESPONDER=fixture WA_BOT_SECRET=<32+
characters> pnpm dev`, and the same `WA_BOT_SECRET` for the script) and, for the AlurSekolah
read-back, WS-07 connected to the mock (Admin › Integrasi: URL `http://localhost:3003`, key
`as_uji_sdit_nusantara_2026`). It sends the official F1-1 grade-book photo
(`packages/ai/src/school/fixtures/f1-1-buku-nilai-4b.jpg`) the way `apps/wa-bot` does and checks:
the card in one of two tabs only, Mulai and "Ini nilai apa, Bu?" with the photo's title picked (#270), the 10 W5 questions (4
doubtful cells, 5 names, 1 S) with their crops, the cara 1 fill of all 32 students with notes,
Lihat ringkasan beside Simpan, the read-back sentence after the save, the photo gone from the
inbox, Catatan langkah, and every saved grade right in under 5 minutes. Screenshots go to
`.output/verify-grade-photo/`.

`pnpm --filter extension verify:f1-2` runs F1-2 (#208, cara 2) on the same stack with a
development build. It runs the F1 flow twice: Nemu starts filling in cara 1, then the rest
switches to cara 2, once because the teacher takes over ("Saya isi sendiri") and once by "Ajari
saya" (the `?uji-nemu` dock's button, since the test microphone can't say it). The "teacher"
types what Nemu says, except where `features/grade-photo/lib/F1-2_cara-2_skenario.csv` (the
official F1-1 values, with data-uji F1-2's two deliberate mismatches: Bagas 86 for 68, Budi 71 for 77) has her type something else first. It checks that each line is the
book's grade, that both mismatches get "Di buku …, Bu." and never "salah", Catatan langkah, and 0
wrong grades saved. Screenshots go to `.output/verify-f1-2/`.

`pnpm --filter extension verify:f4-1` runs F4-1 (#209) on the Moodle test site started from
`infra/` (README, "Running it on your laptop"): Bu Siti signs in on the mock first (Moodle shows no
AlurSekolah account), opens the F4-1 quiz as `siti.aminah` (password `TEACHER_PASSWORD` from
`infra/.env`, or `MOODLE_TEACHER_PASSWORD`), and types "Nemu, tolong cek kuis ini." It checks that
Nemu opens Setelan, Soal and Kuis itself, points at Pratinjau kuis for her to press, then points at
soal 7 and soal 15 with the sentences in `infra/setup/f4-1/F4-1_kunci.csv` (and, after she opens
soal 15, at its missing image), that Catatan langkah says nothing changed, and that the quiz's
last-modified time and question count in the Moodle database are what they were. `MOODLE_URL`
(default `https://localhost/`) points it at another Moodle; without the local database only the
Soal page's count is compared. It skips with a message when Moodle isn't running. Screenshots go
to `.output/verify-f4-1/`.

`pnpm --filter extension verify:f4-3` runs F4-3 (#211) on the same Moodle, after
`./setup-4a-uji.sh` created the F4-3 quizzes and attempts. On the course page Bu Siti types
"Tolong hapus latihan bahasa Inggris yang kemarin." It checks that Nemu picks "Latihan: My Family
(has/have)" (or asks between it and the decoy on a day the decoy fits "kemarin"; it says which),
opens the quiz and Hasil itself, rings the count and shows the warning word for word with
**Jangan hapus** first and ⚠ on the second choice. Round 1 she keeps it: Catatan langkah, and the
quiz still has 3 finished attempts and 3 grades. Round 2 ("Nemu, hapus kuis Latihan My Family.")
she asks for the button: Nemu switches on Mode Edit, opens the quiz's Edit menu and rings Hapus,
nothing is deleted while it points, she presses Hapus and cancels Moodle's confirmation. Last, in
Moodle's database the quiz and its grades are there and its log has no new deletion, and the local
Nemu Service's action log (WS-10, read from `packages/infra/.alchemy`) has Hapus only as a point
she pressed. Without the local database it checks the pages only. Screenshots go to
`.output/verify-f4-3/`.

`pnpm --filter extension verify:f4-2` runs F4-2 (#210) on the same Moodle. Locally it first removes
an earlier run's "Latihan IPAS Kelas 4A" (`infra/setup/reset-f4-2.php`). On course 4A-UJI Bu Siti
asks Nemu to put her script in, opening Monday 7 December and closing Thursday 10 December, and
picks `infra/setup/f4-2/F4-2_naskah-ipas-10-soal.pdf`. It checks that Nemu asks nothing and says it
uses 00.00 and 23.59, fills the quiz form itself, drops the XML on Impor's picker, and points at
Simpan dan tampilkan, Impor, Tambahkan soal terpilih pada kuis and Pratinjau kuis for her to press;
that the F4-1 check ends with the one sentence; and, in the Moodle database, that the quiz is in
IPAS with those times (Asia/Jakarta) and its 10 questions match
`infra/setup/f4-2/F4-2_hasil-yang-diharapkan.xml` (words without punctuation, choices, key, and
soal 7's three pictures pixel for pixel). Screenshots go to `.output/verify-f4-2/`.

It prints one line per check, exits non-zero on a failure, and saves screenshots to
`.output/verify/` (each open tab is saved too when a check fails). Add `-- --headed` to watch it. `NEMU_SERVER_URL`, `MOCK_ALURSEKOLAH_URL`,
`MOCK_RUANG_GTK_URL` and `MOCK_ERAPOR_URL` point it elsewhere, such as the deployed mocks. If
Playwright's Chromium isn't installed yet, run
`pnpm --filter extension exec playwright-core install chromium` once.
