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
  AlurSekolah and Ruang GTK, the Moodle test site, `web.whatsapp.com`, `http://localhost/*` and the
  Nemu Service. Inside them, the school's WS-03 list from the Nemu Service (`extensionConfig`)
  decides: the content script asks the background first and, off the list, shows and reads
  nothing (e-Rapor is off it on purpose: test WS-1 (a)). The list is read again at most once a
  minute, so a change needs no update. A site the school adds outside the known ones shows
  **Izinkan** on the settings page, which asks Chrome for it (`optional_host_permissions`); the
  background then runs the content script there too.
- **Answers.** The background sends the question to `helpRoute`. Questions about school rules go to
  `helpAsk`, "ini kenapa?" to `helpExplain` with the page's visible text (never input values, and
  nothing while a password field shows), and "berhenti" closes the bubble. Grade entry and
  processes say they aren't available yet: that is the executor, #202.
- **Talking (#200).** Hold **Ctrl + Spasi** on an allowed page, or press and hold the Nemu button,
  and speak: Nemu shows a red dot and "Nemu mendengar…". On release the recording goes to
  `speechTranscribe` as 16 kHz mono WAV, the heard text shows in a small bubble, and then it goes
  to `helpRoute` like a typed question. The microphone runs in an offscreen document
  (`entrypoints/offscreen`), so its permission belongs to the extension: the welcome page that
  opens after install asks for it once, and a hold without it opens that page again. Holds under
  300 ms send nothing; recordings stop at 15 s. The combination will come from WS-08 (#212); until
  then it is `TALK_SHORTCUT` in `features/voice/lib/talk-shortcut.ts`.
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
3. The welcome page opens on install. Press **Izinkan mikrofon**, then **Buka pengaturan Nemu**,
   enter `NEMU-SDITN-2026` and press **Simpan**.
4. Open <http://localhost:3003>, sign in as `siti.aminah` (password `nemu-uji-2026`), click the
   Nemu button, and ask "KKM nilai berapa?". Hold Ctrl + Spasi and speak to talk instead; the
   fixture responder always hears "masukkan nilai UTS Matematika 4B". Sign in as `rizal.operator`
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
- the welcome page has the microphone (a fake one, with the prompt answered for it);
- holding Ctrl + Spasi shows "Nemu mendengar…", then the heard text, then the answer with its
  spoken word highlighted; pressing and holding the Nemu button does the same;
- signing in as `rizal.operator` shows "Akun ini belum didaftarkan. Hubungi Pak Rizal.", and
  signing in as `dewi.lestari` brings the type box back;
- Ruang GTK shows the Nemu button and asks as the last AlurSekolah account;
- e-Rapor gets no Nemu button (WS-1 (a)).

It prints one line per check, exits non-zero on a failure, and saves screenshots to
`.output/verify/` (each open tab is saved too when a check fails). Add `-- --headed` to watch it. `NEMU_SERVER_URL`, `MOCK_ALURSEKOLAH_URL`,
`MOCK_RUANG_GTK_URL` and `MOCK_ERAPOR_URL` point it elsewhere, such as the deployed mocks. If
Playwright's Chromium isn't installed yet, run
`pnpm --filter extension exec playwright-core install chromium` once.
