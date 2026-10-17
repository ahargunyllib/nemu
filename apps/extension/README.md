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

1. Start the stack with `pnpm dev`. To skip OpenRouter, set `NEMU_RESPONDER=fixture` in
   `apps/server/.env`; the server then answers the Momen 1–3 prompts from
   `@nemu/contracts/fixtures` and needs no `OPENROUTER_API_KEY`.
2. Build the extension with `pnpm --filter extension build`, or `pnpm --filter extension dev` to
   rebuild on change.
3. In Chrome, open `chrome://extensions`, turn on Developer mode, and load
   `apps/extension/.output/chrome-mv3` with **Load unpacked**.
4. Log in to the Demo App at <http://localhost:3001>, press Ctrl+Shift+Space, and ask one of the
   Momen prompts, for example "Saya dapat tugas rapat ke Makassar 3 hari, mulai dari mana?".

The extension calls `http://localhost:3000` by default. Set `WXT_SERVER_URL` (in
`apps/extension/.env` or the shell) before building to point it at another Nemu Service; the
manifest's host permission follows it.
