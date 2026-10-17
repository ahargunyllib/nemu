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
- **Highlight (Arahkan).** A `highlight` action scrolls to its target and draws a pulsing amber
  outline with the action label on a click-through page layer; the Answer Card moves aside so it
  never covers a highlight. A target missing from the page becomes a warning on the card. The
  Momen 2 prompt with `NEMU_RESPONDER=fixture` exercises it once the lodging form (#3) is on
  `/perdin/baru`.
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
- on the Perjalanan Dinas form, the Momen 2 prompt shows its answer and warning, rings each lodging
  field with its action label, and keeps the Answer Card off both fields.

It prints one line per check, exits non-zero on a failure, and saves screenshots to
`.output/verify/`. Add `-- --headed` to watch it. Automation can't press the toolbar icon or the
browser-level shortcut, so the script opens the Composer by sending the background's open message
from the service worker. Check Ctrl+Shift+Space by hand when you change the shortcut or the
manifest. If Playwright's Chromium isn't installed yet, run
`pnpm --filter extension exec playwright-core install chromium` once.

The extension calls `http://localhost:3000` by default. Set `WXT_SERVER_URL` (in
`apps/extension/.env` or the shell) before building to point it at another Nemu Service; the
manifest's host permission follows it.
