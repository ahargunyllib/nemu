# Nemu design system (extension)

What the Nemu Extension should look like: colour, type, the mascot, the Composer, the five
display types and the Nemu cursor, the three answer levels, and motion.

## Colour

The App keeps the AlurKerja palette (zinc + blue): those are the shadcn tokens in
`packages/ui/src/styles/globals.css`. Everything Nemu draws over the page (Composer pill, target
labels, mascot glow, highlights, citations) uses **nemu-amber**, deliberately unlike the App's
blue, so Nemu's help never reads as part of the App.

The tokens live in `packages/ui/src/styles/nemu.css` and are Tailwind colours:

| Token                                       | Value                                       | Use                                                                                                 |
| ------------------------------------------- | ------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `nemu`                                      | amber 600 `#B0560C`                         | Composer pill fill, target label pill, solid chips. The only amber that carries white text (5.0:1). |
| `nemu-foreground`                           | white                                       | Text and icons on `nemu`.                                                                           |
| `nemu-soft`                                 | white / 18%                                 | Icon buttons and chips sitting on a `nemu` fill.                                                    |
| `nemu-text`                                 | amber 700 `#8F460A`                         | Nemu links ("Rincian", "Tutup", "Lihat detail") and outline button text (6.9:1).                    |
| `nemu-subtle` / `nemu-subtle-foreground`    | amber 50 / amber 800                        | Citation chips ("PMK 119/2023 · Ps. 8 ayat (5)").                                                   |
| `nemu-secondary`                            | zinc 600 `#52525B`                          | text/secondary: the detail line under a display's sentence (7.7:1).                                 |
| `nemu-danger-strong`                        | `#991B1B`                                   | The red display heading (BELUM JELAS, HATI-HATI), 8.9:1.                                            |
| `nemu-success-strong`                       | `#065F46`                                   | The green display heading (SUDAH DICEK), 7.6:1.                                                     |
| `nemu-ring`                                 | amber 500 `#E07A16`                         | Mascot orbit ring, click ripple. Lines only (Sorot arahkan is `nemu-amber-600`).                    |
| `nemu-glow`                                 | amber 400 `#F59331`                         | Mascot glow, loading shimmer.                                                                       |
| `nemu-success*`                             | `#10B981`, subtle `#ECFDF5`, text `#047857` | "Kamu yang mengirim" label, success card.                                                           |
| `nemu-warning-subtle` / `nemu-warning-text` | `#FFFBEB` / `#B45309`                       | Soft warnings.                                                                                      |
| `nemu-danger-subtle`                        | `#FEF2F2`                                   | Inline warning box inside an Answer Card; text is `destructive`.                                    |
| `nemu-confirm`                              | `#3B82F6`                                   | Sorot konfirmasi: dashed outline on a button the user must press.                                   |
| `nemu-select` / `nemu-select-fill`          | `#297FE4` / `#4D94E8` at 8%                 | Blok area: the dashed line and light fill of the box Rina drags.                                    |

The full amber scale is also available as `nemu-amber-50` … `nemu-amber-800`. Mascot art
colours: body gradient amber 300 → 500, wings amber 100, white outline, white eyes; success body
`#34D399` → `#059669` with badge `#047857`; warning body `#F87171` → `#DC2626`.

The black main button in a card ("Lanjut", "Selesaikan Tugas") is bg/inverse `#18181B`: the stock
shadcn `Button` default variant.

Every Nemu surface floating over the page (Composer, Answer Card, Kartu area, tooltips) casts the
**Float** shadow, `shadow-nemu-float` (`--nemu-shadow-float` in `nemu.css`):
`0 2px 4px rgb(24 24 27 / 0.06), 0 16px 40px rgb(24 24 27 / 0.14)`.

## Typography (Fondasi · Tipografi)

Everything Nemu draws is set in **Plus Jakarta Sans** (400, 500, 600, 700) with a sans-serif
fallback; the App keeps Figtree for text and Outfit for headings. Inside the extension's shadow
root `font-sans` and `font-heading` both resolve to Plus Jakarta Sans
(`apps/extension/entrypoints/nemu.content/style.css`). The font is bundled from
`@fontsource-variable/plus-jakarta-sans` and declared on the page's document by `nemu-font.ts`,
because Chromium ignores `@font-face` inside a shadow root.

| Style                                          | Weight · size/line                        |
| ---------------------------------------------- | ----------------------------------------- |
| Nemu/Card title                                | SemiBold 14.5/19                          |
| Nemu/Card body                                 | Regular 12.5/17                           |
| Heading/H3 (toolbar popup title)               | SemiBold 15/20                            |
| Body/Small                                     | Regular 13/18                             |
| Body/Small Strong                              | Medium 13/18                              |
| Nemu/Calc                                      | Medium 11.5/16                            |
| Nemu/Calc result                               | Bold 14/18                                |
| Label/Caps (card kicker, "RINCIAN HITUNG")     | SemiBold 10.5/14, +8% tracking, uppercase |
| Label/State                                    | SemiBold 12/16                            |
| Label/Chip                                     | Medium 11.5/15                            |
| Label/Button                                   | Medium 13/16                              |
| Caption ("lookup_sbm() · SBM TA 2026 hlm. 19") | Regular 11.5/15                           |

## Mascot (Maskot · State Animasi)

A round firefly: amber gradient body in a thick white outline, two white round eyes, two pale
amber wings (amber 100 ellipses tilted up behind the body), soft amber glow. Seven states:

- **idle**: as described.
- **listening**: same, with an amber orbit ring around the white outline.
- **thinking**: three amber dots top-right.
- **guiding**: same as idle (motion carries the difference).
- **clicking**: the body becomes a cursor arrow pointing up-left, eyes on it, with an amber ring
  (click ripple) at the tip.
- **success**: green body, happy closed eyes (^ ^), dark green check badge bottom-right.
- **warning**: red body, red "!" badge bottom-right.

`NemuMascot` draws idle, success and warning (`mood`); a display heading picks the mood from its
tone.

## Composer (Komposer · Tanya Nemu)

A 300px pill (its own width, not the Answer Card panel's), full `nemu` fill, rounded-2xl,
`shadow-nemu-float`, white text. It is 40px tall for one line and grows to three as the text
wraps, then scrolls. Padding 5px top, right, and bottom and 14px left, 4px gaps. Text is Body/Small
(Regular 13/18); the placeholder "Tanya Nemu…" is white / 92%. Right side: two 30×30 round icon
buttons, crop (Area Crop) then send (`ArrowRight`). States:

1. Empty: both buttons `nemu-soft`.
2. Typed: the send button turns white with an amber arrow.
3. Area select ("Seret area di layar · Esc batal" as the placeholder): the crop button is white.
4. Membaca (after Kirim): a narrower pill in the Composer's place, same fill, 40px tall, padding
   5px 14px, hugging its content, no buttons: three white dots, then "Membaca halaman dan SOP…".
   The answer replaces it in the same spot.

The pill stays `nemu` (amber 600) rather than the design's amber 500: white text on amber 500 is
about 3:1, under the 4.5:1 body text needs. Awaiting designer confirmation.

**Kartu area** (after a box is dragged): a white card, 288 px wide, radius 14 px, 1 px `border`,
padding 10 px top and 12 px on the other sides, 8 px gap, `shadow-nemu-float`. A small cropped
thumbnail (about 48 × 28, rounded and bordered) sits top-left and a close × top-right; the Composer
pill fills the card's inner width below them ("Tanya tentang bagian ini…"). The design also puts a
title (the detected section) and a subtitle (page and step) beside the thumbnail; Nemu has no data
for them yet, so they are left out.

When the tab can't be captured because Nemu wasn't opened from the toolbar icon or the shortcut
(ADR-0004), the thumbnail's place shows a `destructive` crop icon on `destructive/10`, then
"Area belum bisa diambil di tab ini." in `destructive` and, in `muted-foreground`, "Buka Nemu dari
ikon Nemu di toolbar atau Ctrl+Shift+Space, lalu pilih area lagi.", the keys as a subtle
`NemuBadge`.

## The five display types (PRD §6.2)

Everything Nemu shows the teacher is one of five fixed shapes, and only one shows at a time, so a
teacher who rarely uses a computer learns them once. They are built once in `packages/ui/src/nemu/`
(`gelembung-kerja`, `gelembung-tunjuk`, `gelembung-jawab`, `kartu-pilih`, `kartu-info`) from the
stock `Card`, `Button` and `Progress`, and their data is the `NemuDisplay` union in
`@nemu/ui/lib/nemu-display`. `NemuStage` draws the one current display; the extension renders it in
the page's Shadow DOM.

| Type                 | When                   | Shape                                                                                                                           |
| -------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **Gelembung Kerja**  | Nemu is working        | Heading with a count and progress bar, one sentence and its detail line, **[Pelan]** (optional) and **[Berhenti]** on the right |
| **Gelembung Tunjuk** | The teacher's turn     | One sentence beside the field or button the cursor points at, an optional chip. No buttons, at most one link and a cancel link  |
| **Gelembung Jawab**  | An answer or a problem | One sentence, then one row: **Kenapa?**, **Sumber**, **Lihat ringkasan** left, at most one action button right; ×               |
| **Kartu Pilih**      | A decision             | One question, a detail line, 2–3 equal stacked big buttons, nothing pre-selected or focused                                     |
| **Kartu Info**       | Something to read      | A title, a short numbered list, then one row: at most one link left (Catatan langkah: "Coba sendiri"), **[Tutup]** right        |

- **Surface**: every display is the stock card, plain white with its thin `ring-foreground/10`
  edge, `rounded-3xl`, 24 px side padding, and the Float shadow; no amber edge or band. A
  **Gelembung** (bubble) is 420 px wide, a **Kartu** (card) 400 px (the compact Kartu Pilih 300 px).
- **Action row** (`NemuActionRow`): the last row of a display. Small links sit on the left, compact
  buttons on the right, the main one last. A compact button is a 52 px pill with 18 px semibold
  text and no icon: the main action is the stock default Button (black `#18181B`), a second one
  the stock outline with a 2 px edge on white. Gelembung Kerja: **Pelan** (outline, only when the
  caller passes `onSlow`) then **Berhenti** (black). What a link opens shows under the whole row.
- **Close**: Gelembung Jawab's × is a 44 px round `secondary` icon button at the top right, level
  with the heading. Kartu Info has no ×, only **Tutup**.
- **Heading** (Kepala, `status`): every display can open with one row: the 28 px mascot, a short
  label in Label/Caps (14 px bold, +6% tracking, uppercase), and on the right an optional count in
  16 px semibold `nemu-secondary` ("3 dari 32", "1 dari 2", "10.02"). With `progress` an 8 px bar
  (`nemu` on `nemu-amber-100`) runs under it and the count defaults to "13 dari 32". The label's
  colour follows the situation (`tone`): **nemu** amber 800 for Nemu's own work and the teacher's
  turn (NEMU MENGISI, GILIRAN IBU, JAWABAN); **muted** `nemu-secondary` grey when Nemu is held up
  (NEMU BERHENTI, MIKROFON TERBLOKIR); **danger** `nemu-danger-strong` `#991B1B` red (BELUM
  JELAS); **warning** the same red with the warning mascot (HATI-HATI); **success**
  `nemu-success-strong` `#065F46` green with the success mascot (SUDAH DICEK). The older tones
  still work: `working` and `unsaved` draw as nemu, `saved` as success. All five types take it.
- **Text**: every display leads with one bold line, the sentence of a Gelembung (24 px semibold),
  the question of a Kartu Pilih or the title of a Kartu Info (20 px semibold). Under it can sit one
  quieter **detail** line (`detail`, 18/26 regular, `nemu-secondary` `#52525B`, 7.7:1): "Klik atau
  ketik kalau Ibu mau isi sendiri.", "Pilih salah satu, Nemu menunggu." In a Kartu Pilih it sits
  between the question and the choices. It is never read aloud and is not part of the sentence
  that says itself again.
- **Sizes**: the sentence is 24 px (semibold), card text 20 px, the detail line and links 18 px,
  the heading label 14 px bold capitals. Every button and link is at least 44 px tall; the
  compact buttons are 52 px with 18 px text, Kartu Pilih's choices at least 56 px with 20 px text.
- **Contrast ≥ 7:1**: text is `foreground` on white, or `nemu-strong` (amber 800, Nemu's dark
  orange) on white or `nemu-subtle`. The main button of every display is the stock black default
  with white text. The lighter `nemu` (5.0:1) is only for the progress bar, the cursor's label
  and the target ring.
- **Colour is never the only signal**: the heading's words say the state ("Nemu mengisi",
  "Belum jelas", "Sudah dicek") and the warning and success headings change the mascot too; a
  risky choice carries a ⚠ icon (and "Berisiko" for screen readers); the spoken word is tinted
  and underlined.
- **Never read aloud**: the heading, the links and the buttons. Nemu says only the sentence
  (`spokenText`), the question of a Kartu Pilih, or the title of a Kartu Info, never the detail
  line under it.
- **Links**: Kenapa?, Sumber and Lihat ringkasan are small underlined `nemu-strong` links. What is
  behind them is read (`onRead`) only once the teacher clicks.
- **Kenapa? and Sumber cards** (`NemuNoteCard`): the link's card takes the bubble's place, in the
  Kartu Info look, and its black **Tutup** brings the bubble back (a new answer also shows as a
  bubble). The heading says which: **KENAPA?**, or **SUMBER** with the process on the right
  ("Alur SPP sekolah", `sumberName`). Then a 20 px title: Kenapa?'s `kenapaTitle` ("Kenapa muncul
  pesan ini?" for a message on the page), Sumber's `sumberTitle` ("Kenapa nilai bisa belum
  tampil?") with `sumberNote` as its detail line, or the process's name when there is no other
  title (then it is not repeated on the heading). The body is the reason as one paragraph, a
  process's steps numbered like Kartu Info's list (`sumberSteps`), or the sources as a plain list
  (a document Nemu can open is a link). Only real steps are numbered. Left of Tutup sits one link:
  on the Kenapa? card it opens Sumber ("Sumber: Kamus Kendala · K-07", "Sumber: Alur SPP
  sekolah"); on the Sumber card it opens the diagram, "Lihat diagram (operator)". Nemu reads the
  card's title, then its detail line and its paragraph or steps.
- **Lihat ringkasan** opens under the links in a `nemu-subtle` box instead, so the sentence it
  belongs to (often "Tekan Simpan") stays in view.
- **Kartu Pilih**: a risky choice gets ⚠ and goes under the safe one, whatever order it was given
  in. All choices share one look. The **compact** Kartu Pilih (300 px, 44 px buttons side by side)
  waits beside the Nemu button, such as "Foto dari WhatsApp · Mulai / Nanti". Its picture is a
  64 px square thumbnail left of the title (`rounded-xl`, 2 px `border`, cropped from the top so
  the photo's heading shows), and a `Skeleton` of that square while it loads (#278).
- **Kartu Info list**: the `items` are an ordered list, each led by a 30 px circle with its number
  (`nemu-subtle` fill, 1 px `nemu-amber-200` edge, 15 px bold `nemu-strong`) and 20 px regular
  text. An optional label sits above it (`itemsLabel`, 16 px semibold `nemu-secondary`):
  "Catatan langkah · Cara isi nilai kelas". The label also names the list for screen readers.
- **Gelembung Tunjuk extras**: an optional **chip** under the text (`chip`, a `subtle`
  `NemuBadge` pill 34 px tall with a `nemu-amber-200` edge and 16 px semibold text: "Belum
  tersimpan") and an optional **cancel link** at the bottom (`cancel`, a `nemu-strong` link:
  "Batal, jangan hapus"). Still no buttons.
- **Spoken word** (#200): `highlightedWord` marks the word Nemu's voice is on.

**The Nemu cursor** (F0-16, PRD v2.3 P1-7): the 44 px Nemu mascot (`NemuMascot`, the same idle
firefly as on the Nemu button), click-through (`pointer-events: none`). While it glides, a "Nemu"
label sits just right of it: a solid `NemuBadge` with a white edge and the Float shadow. The label
hides once a bubble is attached to the cursor, so the bubble isn't crowded. Before a display
about a page element appears, the cursor glides there in 0.6 s (from where it last stood, or the
Nemu button the first time) and rests just right of the element, level with its middle. Then the
element gets the Sorot arahkan ring and only then does the display appear and Nemu speak. The
bubble sits on the free side of the cursor: right of it, below-right, below, above-right, above,
or left of the element, the first that fits in the window and covers none of the page's own
controls (the field being filled and the ones after it). It also keeps clear of the whole
mascot, which stands taller than a short target such as a link.
A display about no element (an answer to a typed question, most Kartu) sits above the Nemu button.
An "ini kenapa?" answer is about the message it explains (F2 · 02): the cursor glides to that
message on the page (the first error read when she asked, else the first message), rings it, and
the Gelembung Jawab sits beside it, Kenapa? and Sumber cards included. If the message is gone or
out of view, the answer sits above the Nemu button.

**Pointing at the browser** (#268): Chrome's microphone prompt is browser UI over the top left
of the page, which Nemu can't see. The first time the teacher talks on a site, the cursor glides to
the prompt's measured place instead: just right of its edge, level with its top **Izinkan** button.
The Gelembung Tunjuk beside it names the button, "Tekan Izinkan yang paling atas di kotak Chrome
supaya Nemu bisa mendengar, Bu.", in case the cursor stands a little off (ADR-0019).

**Preview**: in a dev build, open an allowed page with `?pratinjau-nemu` (for example
`http://localhost:3003/?pratinjau-nemu#/nilai` on the mock AlurSekolah). A dock at the bottom left
shows each type with sample content; **Gerak kursor** moves the cursor between Kelas and
Tampilkan Siswa.

## Answers: three levels (Tingkat)

- **Tingkat 0 · Label target**: a clear step only needs the target outlined and labelled with
  2–4 words, no card. The outline is Sorot arahkan (see Motion). The label is a fully rounded
  `nemu` pill 26px tall (padding 3px top and bottom, 10px right, 3px left, gap 6px) with a 1px
  white border and the `shadow-nemu-float` shadow; its text is SemiBold 12/16 white, with a small
  white circle holding the mascot at its left: "Pilih ini", or "Isi Rp447.000 · 30% × 2 malam"
  (the part after · Regular at 80%). It sits to the right of the element, level with the
  outline's top, so it covers none of the target; with no room on the right it falls back to the
  outline's top-right edge (bottom-right near the top of the viewport), overlapping it. The
  success variant, for Sorot konfirmasi, is `nemu-success`: "Kamu yang mengirim".
- **Label names the value**: when Nemu knows what goes into the target, its label names that
  value as the screen shows it, after the verb for the control: "Pilih Dinas luar kota", "Isi
  Makassar", "Pilih ST-090/2026", "Pilih 3 Nov 2026", "Isi Rp447.000". Only when the value is
  unknown does it name the field instead ("Pilih jenis perjalanan", "Unggah laporan perjalanan").
  Momen 1 walks Jenis perjalanan, Kota tujuan, Surat tugas, Tanggal berangkat, Tanggal kembali,
  and Moda transportasi, in that order.
- **Steps**: an answer with several highlights rings one target at a time and waits for the user.
  Pressing the ringed target, or changing the field it holds, removes its ring and rings the next
  step's target; after the last step nothing stays ringed. A click into a field or on a control
  that opens a popup only starts the step.
- **Tingkat 1 · Jawaban teks** (default): a white card beside the highlighted element, the
  element stays outlined. The answer reads like plain chatbot output, see below.
- **Tingkat 2 · Rincian**: a "Rincian ›" text link under the answer opens a muted grey rounded
  box with the detail, each calculation's formula line, and the sources; the link becomes
  "Tutup rincian ›".
- While Nemu reads there is no card: the Composer's Membaca pill stands in for it.

**Jawaban teks**: one card, 280px wide, white, 14px corners, a 1px `border`, 12px padding (14px
on the left), 10px between lines, `shadow-nemu-float`. All text is Body/Small (Regular 13/18).
The only control in the header is the close × at the top-right, beside the first line. There is
no echoed question, no title over a body, no red, and no check marks. Collapsed, a card is short:
kicker, answer, value strip, Rincian:

- **Kicker**: for a guided answer, "Langkah 2 dari 6" (SemiBold 12/16, `nemu-text`) above the
  answer, beside the ×. The card lists no steps and has no back and forth arrows: a step moves on
  when the user acts on its target.
- The answer, then each warning as a sentence ("Ubah isian bila nanti menginap di hotel.").
- **Isi nilai**: when the current step is a confirmed `fill`, a `nemu-subtle` strip under the text
  holds the value in medium weight on the left ("Rp447.000") and a small solid `nemu` **Isi**
  button on the right, which writes it into the field. Once filled, a small green chip
  (`nemu-success-subtle`) at the field's right end says "Sesuai"; if the user changes the value,
  it becomes "Tidak sesuai hitungan Rp447.000 · **Isi ulang**", which writes it again.
- **Salin nilai**: when the answer computed an amount it doesn't fill, the same strip has a copy
  icon with "Salin" on the right. It copies the amount as the form field takes it ("447000") and
  says "Tersalin" for a moment.
- **Rincian** (opened): the detail as plain text, lists written "1. 2. 3."; each calculation's
  formula line in Nemu/Calc ("30% × Rp745.000 × 2 malam = Rp447.000", led by what it computes
  when there are several); then quiet Caption text "Sumber: PMK 119/2023 Pasal 8 ayat (5) · SBM
  TA 2026 …", each source once.
- **Balas**: the Composer pill ("Tanya Nemu…") inside the card, last, to ask again from it.

Cards in place of an answer use the same format: plain text, ×, and at most one text link as the
way forward.

- **Peringatan / Tidak ditemukan**: "Kamu belum masuk ke Demo App. …" with a "Masuk ke Demo App"
  link, or "Pertanyaan belum terjawab. …" with "Coba lagi". A target missing from the page is a
  warning sentence in the answer.
- **Berhasil**: once the user presses Selesaikan Tugas, the answer says "Terkirim, pindah ke Verifikasi.
  ID tugas PJ-PD-2026-0042."

## Toolbar popup (Akses · situs lain)

On a page outside the allowlist the toolbar icon opens a popup instead of the Composer
(ADR-0004). It is 320 px wide, white, padding 16 px, 10 px between rows; the browser draws the
popup's frame and shadow. Rows:

1. The idle mascot at 28 px, 8 px gap, "Nemu" in Body/Small Strong.
2. "Nemu aktif di AlurKerja" in Heading/H3.
3. "Di situs ini Nemu tidak membaca apa pun. Buka AlurKerja untuk bertanya soal proses kerja." in
   Body/Small, `muted-foreground` (the design's text/secondary `#52525B` is now `nemu-secondary`,
   not used here yet).
4. "Buka AlurKerja": a full-width `NemuButton` with `tone="solid"`, opening the Demo App in a new
   tab.

## Motion (Motion Kursor)

- **Sorot arahkan**: a thin, strong outline around the target: 2px solid `nemu-amber-600`,
  radius 10px, 4px off the element, no glow, halo, or pulse. Fades in over 250 ms.
- **Sorot konfirmasi**: dashed `nemu-confirm` outline around a submit button the user presses;
  appears in 250 ms. On a coloured header use a white dashed line instead.
- **Click ripple**: an amber ring that expands at the click point.
- **Loading**: a thin white bar with an amber shimmer moving across.
- **Klik navigasi**: the mascot-cursor travels to the target, a ripple ring plays on it, and a
  dark pill tooltip (the inverse `foreground` fill, white 11.5px medium text) under it says
  "Membuka Perjalanan Dinas… [Esc]", naming the target. The Answer Card stays under the cursor,
  its tooltip, and the mascot while that cursor is on the page.
- **Sorot guiding**: the target outlined with the "Pilih ini" label, the mascot waiting beside it.
  The mascot flies to the active target and the Answer Card hangs off it, the mascot on the card's
  top-left corner. The card sits right next to the target: just above it, its right end level with
  the target's (where the label is), so it covers only rows already filled; with no room above,
  below it; then beside it. It never covers the active target or the next field still to fill.
  When the guide moves to the next step, card and mascot move to its target. An answer with no
  target (or a failure) puts the card in empty space, off the page's content, such as Beranda's
  Tugas berikutnya.
- **Blok area**: the selection box Rina drags: a 1.5 px dashed `nemu-select` line (dash 5, gap 4),
  radius 4 px, a `nemu-select-fill` fill, and round amber (`nemu-ring`) corner handles. The rest of
  the page is never darkened, and the box is never filled black. The mascot sits as the cursor at
  the box's bottom-right corner. While Nemu reads, the box stays as a grey dashed outline.
