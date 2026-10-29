# Nemu Extension

The Chrome extension Rina uses on the Demo App: Ctrl+Shift+Space opens the Composer beside the
cursor, and the answer from `nemuChat` comes back as an Answer Card.

- **Allowlist.** The content script runs only on the Demo App origins in
  `shared/lib/config.ts`. Other pages get no overlay and send nothing to the Nemu Service.
- **No login of its own.** The background service worker calls `nemuChat` with
  `credentials: "include"`, so the Demo App's better-auth session cookie goes along. The server
  takes the user from that session; the extension never sends `user_id`. Signed out, the card asks
  Rina to log in to the Demo App.
- **Contract.** Request and response schemas come from `@nemu/contracts`.
- **Element List.** Every prompt carries the page's rendered elements that have a
  `data-nemu-id` (at most 150, under 50 KB, never an input's value). Off-screen ones are sent
  with `visible: false` so Nemu can still point at them.
- **Area Crop.** The crop button in the Composer starts area select mode: Rina drags a box over
  the page, Nemu hides its own overlay, and the background screenshots the viewport
  (`captureVisibleTab`, which is why the manifest asks for `<all_urls>`; the background still
  captures allowlisted tabs only). The content script cuts out just the box (longest side at most
  1280 px) and shows it as a removable chip in the Composer. It goes with the next prompt as
  `screenshot_crop`, and the full screenshot never leaves the tab. The Nemu Service never stores
  the image: the Chat Log only notes that one was attached.
- **Highlight (Arahkan).** A `highlight` action scrolls to its target and draws a pulsing amber
  outline with the action label on a click-through page layer; the Answer Card moves aside so it
  never covers a highlight. A target missing from the page becomes a warning on the card. The
  Momen 2 prompt with `NEMU_RESPONDER=fixture` exercises it once the lodging form (#3) is on
  `/perdin/baru`.
- **Navigation click (Jalan sendiri).** A `click` action runs only when its target is Jalan sendiri
  in the bundled Action Level config (`features/action-level/lib/action-level-config.ts`,
  ADR-0002) and was in the Element List sent with the prompt; any other click becomes a highlight.
  The cursor morphs from where Rina opened the Composer (200 ms), moves to the target (400–800 ms),
  clicks, and waits up to 2 s for a new URL or a new nemu_id on the page. Esc before the click
  lands stops it. A stopped click, a missing target, or a click that changed nothing falls back to
  a highlight, and the cursor shows a warning. Ids missing from the config count as Arahkan, so
  list a new id there to let Nemu click it.
- **Mascot.** A 32 px mascot follows the cursor 12 px below and to the right of its tip (flipping
  sides at the viewport's edge), so it never sits on what Rina is about to click. It waits when
  the cursor closes in on it, so it can be clicked to open the Composer. It waits beside the Composer while that is open and rides along
  with Nemu's cursor during a navigation click. Its seven states follow what Nemu is doing: idle,
  listening (Composer open), thinking (after Kirim), guiding (highlights) or clicking, then
  success (the click opened the page) or warning (a failed request, missing target, or click that
  changed nothing). Results rest after 3 s, and Esc returns it to idle. Under
  prefers-reduced-motion it jumps instead of gliding and doesn't animate. The art in
  `features/mascot/assets/` is placeholder SVG: replace each file under the same name with the
  final art.
- **Follow-up on the new page.** A navigation click with a server `guide` asks the same question
  again after it lands:
  once the new page has no `Skeleton` and its nemu_ids hold still for 300 ms (3 s at most), the
  extension sends the prompt with that page's Element List. It reserves each guide/page/step
  signature once, so a repeated render cannot loop. Momen 1 continues on the form and Momen 3 on
  its task page; fixture mode tells their initial and follow-up requests apart by Element List.
- **Cancel pending answers.** Closing the card or pressing Esc while Nemu is thinking aborts the
  content request and the matching background fetch. A completion that arrives after cancellation
  is ignored rather than replacing the closed UI.
- **Konfirmasi.** A `confirm` action rings its target with its label (Momen 3: Kirim, "Kamu yang
  mengirim"), and the extension never clicks it. On a task page (`/perdin/task/$instanceId`), once
  Rina presses it, the background reads `getProcessInstance` until the State moves and the Answer
  Card shows the task ID and the new State (Verifikasi). A `batas_pertanggungjawaban` calc entry
  shows as a deadline chip on the card.
- **Confirmed fill.** A `fill` action never changes a field immediately. It shows a button beside
  the exact target; only Rina pressing it applies the raw contract value and dispatches normal
  input/change events. If she later enters a different value, Nemu leaves it untouched and shows
  a mismatch badge.
- **Shortcut.** Ctrl+Shift+Space is bound to the extension's action (`_execute_action`, shown
  as "Activate the extension"), the same as clicking the Nemu toolbar icon. It's not a page key
  listener because macOS, the browser, or another app can take the keys before the page sees
  them, and not a custom command because Arc never fires those. If the shortcut does nothing,
  something else owns the combo: rebind it at `chrome://extensions/shortcuts`
  (`arc://extensions/shortcuts` in Arc), or click the toolbar icon. A changed default only
  applies to a fresh install, so remove and re-load the extension to pick it up.

## Install the latest build

Every deploy from `main` rebuilds the extension against the production Nemu Service and replaces
the zip on the `extension-latest` release:
<https://github.com/ahargunyllib/nemu/releases/download/extension-latest/nemu-extension-chrome.zip>.
Unzip it, then load the folder unpacked as in step 2 below. To update, replace the folder's
contents with the new zip and click the reload icon on the extension card. The build's version is
`0.1.<run number>`: the extension card shows it, and the release notes name the matching commit.
A local build stays `0.0.0`.

## Run it

1. Start everything with `pnpm dev`: the server on :3000, the Demo App on :3001, and the
   extension's dev build, which rebuilds on change into `apps/extension/.output/chrome-mv3-dev`.
   `pnpm dev` doesn't open a browser, so it works without Chrome installed.
   To skip OpenRouter, set `NEMU_RESPONDER=fixture` in `apps/server/.env` (or prefix the command:
   `NEMU_RESPONDER=fixture pnpm dev`); the server then answers only the three Momen prompts from
   `@nemu/contracts/fixtures` and needs no `OPENROUTER_API_KEY`.
2. Load the extension unpacked in any Chromium browser:
   - **Chrome**: open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked**.
   - **Arc**: open `arc://extensions`, turn on **Developer mode**, click **Load unpacked**.

   Pick `apps/extension/.output/chrome-mv3-dev`. For a production-style build instead, run
   `pnpm --filter extension build` and load `apps/extension/.output/chrome-mv3`.

3. Log in to the Demo App at <http://localhost:3001> (the login page has demo-account buttons),
   press Ctrl+Shift+Space (Ctrl on macOS too, not Cmd) or click the Nemu toolbar icon, and ask
   one of the Momen prompts:
   - "Saya dapat tugas rapat ke Makassar 3 hari, mulai dari mana?"
   - "Saya menginap di rumah saudara, ini diisi apa?"
   - "Saya sudah pulang kemarin, sekarang apa?"

After code changes in dev mode, the dev build reloads itself; if the overlay doesn't update,
click the reload icon on the extension card and refresh the Demo App tab.

## Check it in a real browser

With `NEMU_RESPONDER=fixture pnpm dev` running, `pnpm --filter extension verify` runs a
production build into `.output/chrome-mv3` that calls `http://localhost:3000`, loads it into
Playwright's Chromium, and checks it. It doesn't use the dev build: that one registers its content
script from the WXT dev server instead of the manifest, so under Playwright no overlay appears.
It stops early if the Nemu Service answers with the AI Responder instead of the fixtures. The
checks:

- a page outside the allowlist gets no overlay;
- signed out, the card asks Rina to log in;
- signed in as Rina, the Momen 1 prompt comes back as an Answer Card with its citation;
- Momen 1, five times in a row from Beranda: Nemu clicks Ajukan Perjalanan Dinas, the form opens,
  and the follow-up card guides the six form steps with its citation;
- on the Perjalanan Dinas form's Biaya tab, Momen 2: Rina drags a box over the lodging fields, the chip holds a
  crop of just that box (saved as `momen-2-area-crop-sent.png`), and the prompt goes out with it.
  The card shows the answer, warning and the PMK 119/2023 Pasal 8 ayat (5) citation, rings each
  lodging field with its action label, and keeps off both fields. The amount stays empty until the
  script confirms Rp447.000; changing it to Rp745.000 produces a mismatch badge without overwriting
  the field, and the Chat Log records that an Area Crop was attached;
- Momen 3, five times in a row after a demo data reset: Nemu opens the Pertanggungjawaban task,
  the follow-up rings both missing uploads and Kirim and shows the 12 November 2026 deadline chip,
  and after the script uploads the sample PDFs and presses Kirim, the card shows
  PJ-PD-2026-0042 and Verifikasi;
- the mascot sits 12 px below and to the right of the cursor, and clicking it opens the Composer.
- after switching to Dimas, the header shows the persisted 14 October 2026 Telco clock and the
  script exercises the happy-path calculation, missing-RCA `PERLU_BUKTI` branch, late rejection,
  CRM handoff, exact placeholder IDs, Rp579.167 value, and disabled self-approval control.

It prints one line per check, exits non-zero on a failure, and saves screenshots to
`.output/verify/`. Add `-- --headed` to watch it. Automation can't press the toolbar icon or the
browser-level shortcut, so the script opens the Composer by sending the background's open message
from the service worker. Check Ctrl+Shift+Space by hand when you change the shortcut or the
manifest. If Playwright's Chromium isn't installed yet, run
`pnpm --filter extension exec playwright-core install chromium` once.

In dev, the extension calls `http://localhost:3000` by default. Set `WXT_SERVER_URL` (in
`apps/extension/.env` or the shell) to point it at another Nemu Service; the manifest's host
permission follows it. `wxt build` and `wxt zip` fail without it, so a production build never
ships pointing at localhost:

```bash
WXT_SERVER_URL=https://nemu-api.ahargunyllib.dev pnpm --filter extension build
```
