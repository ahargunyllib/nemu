# Nemu design system (extension)

What the Nemu Extension should look like: colour, type, the mascot, the Composer, the three
answer levels, and motion.

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
   Body/Small, `muted-foreground` (the design's text/secondary `#52525B` has no token yet).
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
