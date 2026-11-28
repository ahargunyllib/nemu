# wa-bot

Receives grade-book photos that teachers send to the Nemu WhatsApp number and hands them to the
Nemu Service's photo inbox, where the extension shows them as a card (F1-01, issue #203). It uses
[whatsmeow](https://github.com/tulir/whatsmeow), an unofficial WhatsApp Web client, with the
session in SQLite.

For each image in a one-to-one chat:

1. Ask the Nemu Service whether the sender is a registered teacher (`POST /api-reference/wa-bot/sender`).
   Unknown numbers are ignored: no read receipt, no download, no reply.
2. Pause, mark the message read, download the photo at full quality (images sent as documents too)
   into a temporary folder.
3. Make a thumbnail of it (`internal/thumbnail`: JPEG, 320 px on its long side) for the
   extension's "Foto dari WhatsApp" card (#278); a photo Go can't decode (WebP) goes without one.
   Post both with the shared secret to `POST /api-reference/wa-bot/photos`, which calls
   `enqueuePhoto`. The same message id twice is one job. Delete the photo.
4. Show the typing indicator, pause, and reply in Indonesian.

Messages are handled one at a time with random pauses, so the number behaves like a person reading
their phone. The rules live in `internal/bot` and are tested with fakes; `internal/whatsapp` is the
whatsmeow glue and `internal/nemu` the HTTP client.

| Variable          | Value                                                              |
| ----------------- | ------------------------------------------------------------------ |
| `NEMU_SERVER_URL` | The Nemu Service, such as `https://nemu-api.ahargunyllib.dev`      |
| `WA_BOT_SECRET`   | The same value as the Worker's `WA_BOT_SECRET`                     |
| `WA_BOT_DATA_DIR` | Where `session.db` lives; `/data` by default (a volume in Compose) |

## Develop

```bash
go test ./...
go vet ./...
```

Deploy and linking the number: `infra/README.md`, section "wa-bot".
