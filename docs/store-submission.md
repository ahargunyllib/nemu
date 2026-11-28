# Store submission: Chrome Web Store and Edge Add-ons

Everything needed to submit the Nemu Extension as an unlisted Chrome Web Store item and an Edge
Add-ons item. Nothing here has been submitted. The submissions need the project's own developer
accounts (the Chrome Web Store charges a one-time registration fee), so the account owner sends
them. What they still have to do is listed under [Steps only the account owner can do](#steps-only-the-account-owner-can-do).

The permission and data answers below match the production manifest built on 27 November 2026.
If `apps/extension/wxt.config.ts` or `apps/extension/shared/lib/config.ts` changes, check them
again.

## Build the zip

One Manifest V3 zip serves both stores: the Chrome and Edge builds have the same manifest. From
the repository root:

```bash
pnpm install
```

```bash
WXT_SERVER_URL=https://nemu-api.ahargunyllib.dev \
WXT_ADMIN_URL=https://nemu-admin.ahargunyllib.dev \
WXT_EXTENSION_VERSION=0.1.0 \
pnpm --filter extension zip
```

The zip is `apps/extension/.output/extension-0.0.0-chrome.zip`. Its file name takes the
`package.json` version (0.0.0), but the manifest inside has `WXT_EXTENSION_VERSION` (0.1.0). Each
upload to a store needs a higher `WXT_EXTENSION_VERSION` than the last one.

An Edge-named zip (`extension-0.0.0-edge.zip`) is also possible, with the same contents:

```bash
WXT_SERVER_URL=https://nemu-api.ahargunyllib.dev \
WXT_ADMIN_URL=https://nemu-admin.ahargunyllib.dev \
WXT_EXTENSION_VERSION=0.1.0 \
pnpm --filter extension exec wxt zip -b edge
```

Check the manifest before uploading:

```bash
unzip -p apps/extension/.output/extension-0.0.0-chrome.zip manifest.json
```

## Listing

| Field      | Value                                                                                                    |
| ---------- | -------------------------------------------------------------------------------------------------------- |
| Name       | Nemu                                                                                                     |
| Visibility | Chrome Web Store: Unlisted. Edge Add-ons: Hidden (reachable only by link), if offered, otherwise Public. |
| Category   | Chrome Web Store: Education. Edge Add-ons: Productivity.                                                 |
| Language   | Indonesian (primary), English                                                                            |
| Icon       | `apps/extension/public/icon/128.png`                                                                     |
| Homepage   | <https://github.com/ahargunyllib/nemu>                                                                   |
| Support    | <https://github.com/ahargunyllib/nemu/issues>                                                            |

### Short description

The Chrome Web Store shows the manifest's `description` as the summary (132 characters at most).
Changing it means changing `wxt.config.ts`.

- Indonesian (in the manifest now): Nemu membantu guru di AlurSekolah, Moodle, dan portal
  pemerintah.
- English: Nemu helps teachers with AlurSekolah, Moodle, and government portals.

### Long description (Indonesian)

> Nemu adalah teman guru di browser. Nemu membantu pekerjaan administrasi sekolah di halaman yang
> sudah Ibu dan Bapak pakai: AlurSekolah, Moodle, dan portal pemerintah.
>
> - Tanya apa saja tentang aturan sekolah. Nemu menjawab hanya dari pengetahuan yang dikelola
>   sekolah, lengkap dengan sumbernya.
> - Kirim foto buku nilai lewat WhatsApp. Nemu membacanya, menanyakan angka yang ragu, lalu
>   mengisi nilai di AlurSekolah bersama Ibu.
> - Pasang kuis di Moodle dari naskah soal, lalu periksa kuis seperti yang dilihat siswa.
> - Bicara langsung: tahan Ctrl + Spasi dan ucapkan pertanyaannya.
>
> Nemu tidak pernah menekan Simpan, Kirim, atau Hapus. Tombol itu selalu ditekan guru sendiri.
>
> Nemu dipakai oleh sekolah yang terdaftar. Operator sekolah memasukkan kode pemasangan sekali di
> halaman pengaturan Nemu.

### Long description (English)

> Nemu is a teacher's companion in the browser. It helps with school administration on the pages
> teachers already use: AlurSekolah, Moodle, and government portals.
>
> - Ask anything about school rules. Nemu answers only from knowledge the school manages, and
>   shows its sources.
> - Send a photo of the grade book over WhatsApp. Nemu reads it, asks about any number it isn't
>   sure of, then fills in the grades in AlurSekolah with the teacher.
> - Put a quiz into Moodle from a question script, then check the quiz the way students see it.
> - Talk to it: hold Ctrl + Space and say the question.
>
> Nemu never presses Save, Send, or Delete. The teacher always presses those buttons.
>
> Nemu is for registered schools. The school operator enters an install code once on Nemu's
> settings page.

### Single purpose

> Nemu helps teachers do school administration on their school's own web apps (AlurSekolah,
> Moodle, and government portals). It answers questions from the school's knowledge and fills in
> forms together with the teacher, who always presses the final save button.

## Permission justifications

These are every permission in the built manifest, with the reason to give the reviewer.

| Permission                                              | Justification                                                                                                                                                                                                                                                   |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `storage`                                               | Keeps the school's install code, the school's list of allowed sites, and the email of the teacher last seen on AlurSekolah (`chrome.storage.local`). Keeps a running task's progress per tab so it continues after the page reloads (`chrome.storage.session`). |
| `scripting`                                             | Runs Nemu's content script on a site the school adds later, after the teacher grants that site on the settings page.                                                                                                                                            |
| Host `https://nemu-api.ahargunyllib.dev/*`              | The Nemu Service. The background service worker sends questions and tasks here and gets answers back.                                                                                                                                                           |
| Host `https://*.alursekolah.id/*`                       | AlurSekolah, the school system Nemu works in. Each school has its own subdomain.                                                                                                                                                                                |
| Host `https://nemu-alursekolah.ahargunyllib.dev/*`      | The demo copy of AlurSekolah used for testing and for the store review.                                                                                                                                                                                         |
| Host `https://nemu-ruang-gtk.ahargunyllib.dev/*`        | The demo copy of a government teacher portal (Ruang GTK).                                                                                                                                                                                                       |
| Host `https://nemu-moodle.ahargunyllib.dev/*`           | The Moodle test site where Nemu puts in and checks quizzes.                                                                                                                                                                                                     |
| Host `https://web.whatsapp.com/*`                       | Shows the Nemu button on WhatsApp Web when the school allows it there. On a site set to "siapkan pesan" (prepare a message), Nemu may only type a message into the box. The teacher reads it and presses Kirim herself.                                         |
| Host `http://localhost/*`, `https://localhost/*`        | Development and the self-hosted Moodle test site run on a laptop. See the review risk below.                                                                                                                                                                    |
| Optional host `https://*/*`                             | Not granted at install. When a school adds another website to its allowed list, the settings page asks Chrome for that one site, and only after the operator presses Izinkan.                                                                                   |
| `web_accessible_resources` (`content-scripts/nemu.css`) | Not a permission. Lets the content script load its own stylesheet on sites granted later.                                                                                                                                                                       |

Inside these sites the school's own allowed-site list (WS-03) decides where Nemu appears. On any
other page Nemu shows nothing and reads nothing.

### Review risks to decide before submitting

- `http://localhost/*` and `https://localhost/*` only help developers. Reviewers often question
  them. Dropping them from the store build needs a small change in
  `apps/extension/shared/lib/config.ts` (for example, adding them only when `WXT_SERVER_URL` is a
  localhost address).
- The three `*.ahargunyllib.dev` demo hosts are test sites. They are useful for the reviewer, but a
  build for real schools may not need them.

## Remote code

> No, I am not using remote code. All JavaScript is in the package. The extension only exchanges
> JSON data with the Nemu Service.

## Privacy and data use

### What the extension sends, and where

The extension talks to one server: the Nemu Service at `nemu-api.ahargunyllib.dev`. Only the
background service worker calls it. Every request carries the school's install code and the email
of the account signed in on AlurSekolah.

| What                                                                                                                              | When                                                                                                                           |
| --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| The teacher's typed question, or a voice recording (WAV, at most 15 seconds) to transcribe                                        | When she asks Nemu something                                                                                                   |
| The visible text of the page, never the values in form fields and nothing while a password field is on the page                   | When she asks "ini kenapa?" (why is this happening?)                                                                           |
| A screenshot of the visible part of the tab                                                                                       | Also for "ini kenapa?", but only if Chrome allows it. With the current permissions Chrome refuses, so only the page text goes. |
| Student names and grades she checked, and the grades the page shows after saving                                                  | When she enters grades from a grade-book photo (F1)                                                                            |
| The question script file (PDF, Word, or photo) she picks, and what Nemu read from a Moodle quiz                                   | When she puts in or checks a quiz (F4)                                                                                         |
| The steps an operator records, including values typed during the recording (never passwords)                                      | Only when the operator starts "Rekam cara"                                                                                     |
| An action log entry: who, when, which website, which task, which action, which field, which cara, and the result, never the value | For every action Nemu takes                                                                                                    |

The Nemu Service passes questions, photos, scripts, and recordings to AI models through
OpenRouter, with data collection denied (see the README's "AI models" section). Grade-book photos
are deleted after the teacher saves, and any left over after one day.

### Chrome Web Store data categories

| Category                            | Tick?           | Why                                                                                                                                                               |
| ----------------------------------- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Personally identifiable information | Yes             | The teacher's email, and student names with grades.                                                                                                               |
| Health information                  | No              | None. An absence code such as S (sick) goes only as a grade-book status.                                                                                          |
| Financial and payment information   | No              | None.                                                                                                                                                             |
| Authentication information          | No              | Nemu never reads or sends passwords. The install code identifies the school, not a person.                                                                        |
| Personal communications             | Yes, to be safe | Nemu doesn't collect chats. But if a teacher asks "ini kenapa?" on WhatsApp Web, the visible page text, which may include a chat, is sent like on any other page. |
| Location                            | No              | None.                                                                                                                                                             |
| Web history                         | No              | Nemu doesn't collect browsing history. The action log names the school website of each action Nemu takes.                                                         |
| User activity                       | Yes             | Voice recordings, and the clicks and typed values of an operator's "Rekam cara" recording.                                                                        |
| Website content                     | Yes             | Visible page text for "ini kenapa?", quiz pages, and grades shown on the page.                                                                                    |

### Certifications

All three are true and can be ticked:

- I do not sell or transfer user data to third parties, outside of the approved use cases.
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose.
- I do not use or transfer user data to determine creditworthiness or for lending purposes.

The AI model providers reached through OpenRouter process data only to answer the request, which
is part of the single purpose.

## Notes for the reviewer

Paste this into the Chrome Web Store "Test instructions" field and the Edge "Notes for
certification" field:

> 1. After install, the welcome page opens. Press "Buka pengaturan Nemu" and enter the install
>    code NEMU-SDITN-2026 (a demo school), then press Simpan.
> 2. Open https://nemu-alursekolah.ahargunyllib.dev and sign in with the demo teacher account
>    listed in the project's apps/extension/README.md ("Run it", step 4).
> 3. Press the Nemu button at the bottom right and ask "KKM nilai berapa?". Nemu answers from the
>    demo school's documents.
>
> All data on these demo sites is made up.

## Steps only the account owner can do

1. Register a Chrome Web Store developer account and pay the one-time fee.
2. Register in Microsoft Partner Center for Edge Add-ons (free).
3. Publish a privacy policy page and put its URL in both listings. Both stores ask for one when an
   item handles personal data. Its content can follow [Privacy and data use](#privacy-and-data-use).
4. Take at least one 1280 × 800 screenshot of Nemu on the demo AlurSekolah. The
   `pnpm --filter extension verify*` runs save screenshots in `apps/extension/.output/verify*/`
   that can serve as a start. The Chrome Web Store also asks for a 440 × 280 promo tile.
5. Decide on the localhost and demo hosts ([Review risks](#review-risks-to-decide-before-submitting)).
6. Build the zip as above and upload it to both stores with the text in this file.
7. Once each listing is live, add its link to the README's "From the Chrome Web Store and Edge
   Add-ons" section.
