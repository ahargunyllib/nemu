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
| `nemu-ring`                                 | amber 500 `#E07A16`                         | Highlight outline (Sorot arahkan), mascot orbit ring, click ripple. Lines only.                     |
| `nemu-glow`                                 | amber 400 `#F59331`                         | Mascot glow, loading shimmer.                                                                       |
| `nemu-success*`                             | `#10B981`, subtle `#ECFDF5`, text `#047857` | "Kamu yang mengirim" label, success card.                                                           |
| `nemu-warning-subtle` / `nemu-warning-text` | `#FFFBEB` / `#B45309`                       | Soft warnings.                                                                                      |
| `nemu-danger-subtle`                        | `#FEF2F2`                                   | Inline warning box inside an Answer Card; text is `destructive`.                                    |
| `nemu-confirm`                              | `#3B82F6`                                   | Sorot konfirmasi: dashed outline on a button the user must press.                                   |

The full amber scale is also available as `nemu-amber-50` … `nemu-amber-800`. Mascot art
colours: body gradient amber 300 → 500, wings amber 100, white outline, white eyes; success body
`#34D399` → `#059669` with badge `#047857`; warning body `#F87171` → `#DC2626`.

The black main button in a card ("Lanjut", "Complete Task") is bg/inverse `#18181B`: the stock
shadcn `Button` default variant.

## Typography (Fondasi · Tipografi)

| Style                                          | Weight · size/line                        |
| ---------------------------------------------- | ----------------------------------------- |
| Nemu/Card title                                | SemiBold 14.5/19                          |
| Nemu/Card body                                 | Regular 12.5/17                           |
| Nemu/Calc                                      | Medium 11.5/16                            |
| Nemu/Calc result                               | Bold 14/18                                |
| Label/Caps (card kicker, "RINCIAN HITUNG")     | SemiBold 10.5/14, +8% tracking, uppercase |
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

One-line pill, full `nemu` fill, rounded-2xl, soft drop shadow, white text, placeholder
"Tanya Nemu…" (white / 92%). Right side: two round `nemu-soft` icon buttons, crop (Area Crop) then
send (arrow). States:

1. Empty: both buttons soft.
2. Typed (wraps to more lines): the send button turns white with an amber arrow.
3. Area select ("Seret area di layar · Esc batal" as the placeholder): the crop button is white.
4. Reading: a narrower pill "••• Membaca halaman dan SOP…" with no buttons.

**Kartu area** (after a box is dragged): a white card with the cropped thumbnail top-left and a
close ×, with the Composer pill inside it below ("Tanya tentang bagian ini…").

## Answers: three levels (Tingkat)

- **Tingkat 0 · Label target**: a clear step only needs the target outlined and labelled with
  2–4 words, no card. The outline is a rounded `nemu-ring` border around the element (Sorot
  arahkan). The label is a `nemu` pill at the element's top-right edge, overlapping the outline,
  with a small white circle holding the mascot at its left: "Pilih ini", or
  "Isi Rp447.000 · 30% × 2 malam" (the part after · lighter). The success variant is green:
  "Kamu yang mengirim".
- **Tingkat 1 · Jawaban ringkas** (default): a white card beside the highlighted element, the
  element stays outlined. Header: mascot icon + title in Card title style ("Pilih \"Tidak menginap
  di hotel\""), close ×. Body: a muted bordered calc box ("30% × Rp745.000 × 2 malam" over a bold
  "Rp447.000"), then a citation chip (`NemuBadge tone="subtle"`). Footer: "Rincian" amber link
  left, black "Lanjut" pill right.
- **Tingkat 2 · Rincian**: the same card opened up: formula, sources, and warnings (a
  `nemu-danger-subtle` box with destructive text, "Ubah isian bila nanti menginap di hotel.").
  The footer link becomes "Tutup".
- **Berhasil**: success card, green mascot, title "Terkirim ke verifikator", muted meta
  ("PD-2026-0042 · tahap Verifikasi"), no buttons, disappears after 3 seconds.
- **Peringatan / Tidak ditemukan**: red mascot, title "Laporan itu belum ada", body text, then an
  amber outline pill "Buka My Requests" (`NemuButton tone="outline"`) and "Tutup" link.

Panel variants carry a kicker row above the title: tiny mascot + Label/Caps text ("TANYA NEMU",
"MEMBACA…", "JAWABAN", "BERHASIL" in green, "TIDAK DITEMUKAN" in red), close × on the right.
"Membaca…" shows skeleton lines under "Membaca halaman dan sumber instansi…". The Tanya Nemu panel
shows an "Area: Penginapan" muted chip, a bordered textarea, "Enter kirim · Esc batal" hint and a
round black send button.

Other pieces: a result strip "Rp447.000 [copy icon] Salin" on `nemu-subtle`; numbered steps
("1 Surat tugas dari atasan"); a black toast with a green dot
"Task completed · moved to Verifikasi"; a red text chip "Batas 12 Nov 2026 · sisa 5 hari kerja".

## Motion (Motion Kursor)

- **Sorot arahkan**: rounded `nemu-ring` outline around the target.
- **Sorot konfirmasi**: dashed `nemu-confirm` outline around a submit button the user presses;
  appears in 250 ms. On a coloured header use a white dashed line instead.
- **Click ripple**: an amber ring that expands at the click point.
- **Loading**: a thin white bar with an amber shimmer moving across.
- **Klik navigasi**: the mascot-cursor travels to the target, a ripple ring plays on it, and a
  black pill tooltip under it says "Membuka Perjalanan Dinas… Esc".
- **Sorot guiding**: the target outlined with the "Pilih ini" label, the mascot waiting beside it.
- **Blok area**: a dashed blue selection box with amber round corner handles, mascot at the
  bottom-right corner, the rest of the page dimmed.
