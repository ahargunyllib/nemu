/** What Nemu says about the microphone (PRD v2.3); `honorific` is "Bu", "Pak" or empty. */

function to(honorific: string, sentence: string, end = "."): string {
  return honorific ? `${sentence}, ${honorific}${end}` : `${sentence}${end}`;
}

/** Gelembung Tunjuk beside Chrome's prompt, the first time she talks on a site. */
export function pointAtAllow(honorific: string): string {
  return to(honorific, "Tekan Izinkan yang paling atas di kotak Chrome supaya Nemu bisa mendengar");
}

/** After she allowed it: this hold wasn't recorded, so she holds again. */
export function microphoneReady(honorific: string): string {
  return `Mikrofon sudah siap. ${to(honorific, "Tahan lagi tombolnya sambil bicara")}`;
}

/** She closed Chrome's prompt without choosing; the next hold asks again. */
export const PROMPT_CLOSED =
  "Nemu belum bisa mendengar. Tahan lagi tombolnya, lalu tekan Izinkan di kotak Chrome.";

/**
 * Kartu Info for a blocked microphone: three steps to allow it again, then [Tutup] (F0-17).
 * Chrome lets the page use the microphone as soon as it is allowed, but shows a "Muat ulang" bar
 * after the change, so the last step reloads to match what she sees.
 */
export const MICROPHONE_BLOCKED = {
  title: "Mikrofon masih diblokir",
  items: [
    "Pertama, tekan ikon di kiri alamat situs, di bagian atas layar.",
    "Kedua, pada Mikrofon, pilih Izinkan atau nyalakan tombolnya.",
    "Terakhir, muat ulang halaman, lalu tahan lagi tombolnya.",
  ],
} as const;
