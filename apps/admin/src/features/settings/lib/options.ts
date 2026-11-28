import { type Cara, FILL_INTERVAL_MS, type FillSpeed } from "@nemu/contracts/extension";

/** WS-08 choices, in the words the operator reads (PRD §6.1). */
export const CARA_OPTIONS: Array<{ value: Cara; label: string; description: string }> = [
  {
    value: "isi",
    label: "Cara 1 · Nemu kerjakan, Ibu lihat",
    description: "Nemu mengisi kolom satu per satu, guru menonton lalu menekan Simpan.",
  },
  {
    value: "tunjuk",
    label: "Cara 2 · Nemu tunjuk, Ibu isi",
    description: "Nemu menunjuk kolom dan menyebut isinya, guru yang mengetik.",
  },
  {
    value: "cek",
    label: "Cara 3 · Guru isi, Nemu cek",
    description: "Guru mengisi sendiri; Nemu memeriksa setelah Simpan.",
  },
];

export const FILL_SPEED_OPTIONS: Array<{ value: FillSpeed; label: string }> = [
  { value: "pelan", label: "Pelan" },
  { value: "normal", label: "Normal" },
  { value: "cepat", label: "Cepat" },
];

export function caraLabel(cara: Cara): string {
  return CARA_OPTIONS.find((option) => option.value === cara)?.label ?? cara;
}

/** Cara 1's pace in fields a second, from the executor's own interval: "±1 kolom per detik". */
export function fillSpeedSummary(speed: FillSpeed): string {
  const seconds = FILL_INTERVAL_MS[speed] / 1000;
  return seconds >= 1
    ? `±1 kolom per ${seconds === 1 ? "" : `${seconds} `}detik`
    : `±${1 / seconds} kolom per detik`;
}
