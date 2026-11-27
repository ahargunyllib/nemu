import type { Cara, FillSpeed } from "@nemu/contracts/extension";

/** WS-08 choices, in the words the operator reads (PRD §6.1). */
export const CARA_OPTIONS: Array<{ value: Cara; label: string; description: string }> = [
  {
    value: "isi",
    label: "Cara 1 · Nemu isi",
    description: "Nemu mengisi kolom satu per satu, guru menonton lalu menekan Simpan.",
  },
  {
    value: "tunjuk",
    label: "Cara 2 · Nemu tunjukkan",
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
