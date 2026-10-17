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
  the cursor closes in on it, so it can be clicked to open the Composer, and its hover × hides it
  until the Composer next opens. It waits beside the Composer while that is open and rides along
  with Nemu's cursor during a navigation click. Its seven states follow what Nemu is doing: idle,
  listening (Composer open), thinking (after Kirim), guiding (highlights) or clicking, then
  success (the click opened the page) or warning (a failed request, missing target, or click that
  changed nothing). Results rest after 3 s, and Esc returns it to idle. Under
  prefers-reduced-motion it jumps instead of gliding and doesn't animate. The art in
  `features/mascot/assets/` is placeholder SVG: replace each file under the same name with the
  final art.
- **Shortcut.** Ctrl+Shift+Space is bound to the extension's action (`_execute_action`, shown
  as "Activate the extension"), the same as clicking the Nemu toolbar icon. It's not a page key
  listener because macOS, the browser, or another app can take the keys before the page sees
  them, and not a custom command because Arc never fires those. If the shortcut does nothing,
  something else owns the combo: rebind it at `chrome://extensions/shortcuts`
  (`arc://extensions/shortcuts` in Arc), or click the toolbar icon. A changed default only
  applies to a fresh install, so remove and re-load the extension to pick it up.

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

With `NEMU_RESPONDER=fixture pnpm dev` running, `pnpm --filter extension verify` loads the dev
build into Playwright's Chromium and checks:

- a page outside the allowlist gets no overlay;
- signed out, the card asks Rina to log in;
- signed in as Rina, the Momen 1 prompt comes back as an Answer Card with its citation;
- Momen 1, five times in a row from Beranda: Nemu clicks Ajukan Perjalanan Dinas, the form opens,
  and the card's detail lists the documents to prepare;
- on the Perjalanan Dinas form, Momen 2: Rina drags a box over the lodging fields, the chip holds a
  crop of just that box (saved as `momen-2-area-crop-sent.png`), and the prompt goes out with it.
  The card shows the answer, warning and the PMK 119/2023 Pasal 8 ayat (5) citation, rings each
  lodging field with its action label, and keeps off both fields. Nemu fills in neither field,
  and the Chat Log records that an Area Crop was attached;
- the mascot sits 12 px below and to the right of the cursor, and clicking it opens the Composer.

It prints one line per check, exits non-zero on a failure, and saves screenshots to
`.output/verify/`. Add `-- --headed` to watch it. Automation can't press the toolbar icon or the
browser-level shortcut, so the script opens the Composer by sending the background's open message
from the service worker. Check Ctrl+Shift+Space by hand when you change the shortcut or the
manifest. If Playwright's Chromium isn't installed yet, run
`pnpm --filter extension exec playwright-core install chromium` once.

The extension calls `http://localhost:3000` by default. Set `WXT_SERVER_URL` (in
`apps/extension/.env` or the shell) before building to point it at another Nemu Service; the
manifest's host permission follows it.
