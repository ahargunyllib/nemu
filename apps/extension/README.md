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
   press Ctrl+Shift+Space (Ctrl on macOS too, not Cmd), and ask one of the Momen prompts:
   - "Saya dapat tugas rapat ke Makassar 3 hari, mulai dari mana?"
   - "Saya menginap di rumah saudara, ini diisi apa?"
   - "Saya sudah pulang kemarin, sekarang apa?"

After code changes in dev mode, the dev build reloads itself; if the overlay doesn't update,
click the reload icon on the extension card and refresh the Demo App tab.

The extension calls `http://localhost:3000` by default. Set `WXT_SERVER_URL` (in
`apps/extension/.env` or the shell) before building to point it at another Nemu Service; the
manifest's host permission follows it.
