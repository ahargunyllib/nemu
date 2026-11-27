import type { ModelQuizScript } from "../quiz/script.js";

/**
 * Offline script reading (`NEMU_RESPONDER=fixture`): what a model reads from Richard's synthetic
 * F4-2 script (`infra/setup/f4-2/F4-2_naskah-ipas-10-soal.pdf`), word for word, with its key from
 * page 4. Soal 7's choices are the script's three pictures; (c) sits at the top of page 3. The
 * pictures themselves come out of the PDF through the real code. Any other file reads as no
 * questions offline, so Nemu says so instead of inventing any.
 */

/** SHA-256 of the F4-2 script, so the offline reading answers only for that file. */
export const F4_2_SCRIPT_SHA256 =
  "e94e51c14ed57c283aa43dc76997ad6e568373e4969b654eee5cdc7f4f874922";

type Read = [number, string, string[], string];

const WORDS: Read[] = [
  [
    1,
    "Tarikan atau dorongan pada suatu benda disebut ....",
    ["energi", "gaya", "usaha", "massa"],
    "b",
  ],
  [
    2,
    "Contoh gaya otot adalah ....",
    [
      "buah jatuh dari pohon",
      "magnet menarik paku",
      "anak menendang bola",
      "perahu terbawa arus sungai",
    ],
    "c",
  ],
  [
    3,
    "Benda berikut yang dapat ditarik magnet adalah ....",
    ["paku besi", "penghapus karet", "pensil kayu", "gelas plastik"],
    "a",
  ],
  [
    4,
    "Energi yang tersimpan di dalam makanan disebut energi ....",
    ["listrik", "bunyi", "cahaya", "kimia"],
    "d",
  ],
  [
    5,
    "Lampu yang menyala mengubah energi listrik menjadi energi ....",
    ["gerak", "cahaya", "kimia", "bunyi"],
    "b",
  ],
  [
    6,
    "Skala peta 1 : 100.000 artinya 1 cm di peta sama dengan ... pada jarak sebenarnya.",
    ["1 km", "10 km", "100 m", "100 km"],
    "a",
  ],
  [
    8,
    "Dataran rendah banyak dimanfaatkan penduduk untuk ....",
    ["perkebunan teh", "persawahan", "tempat pendakian", "hutan pinus"],
    "b",
  ],
  [
    9,
    "Penyebab utama perubahan iklim adalah bertambahnya ... di udara.",
    ["uap air hujan", "jumlah pohon", "air laut", "gas rumah kaca"],
    "d",
  ],
  [
    10,
    "Cara menghemat energi listrik di rumah adalah ....",
    [
      "menyalakan televisi tanpa ditonton",
      "membuka pintu kulkas lama-lama",
      "mematikan lampu pada siang hari",
      "mengisi daya ponsel semalaman",
    ],
    "c",
  ],
];

const choice = (text: string | null, image: string | null = null) => ({
  label: "",
  text,
  text_candidates: [],
  image,
  image_missing: false,
});

export const F4_2_READING: ModelQuizScript = {
  readable: true,
  title: "Latihan IPAS Kelas 4A",
  subject: "IPAS",
  class_name: "4A",
  questions: [
    ...WORDS.map(([number, text, choices, key]) => ({
      number,
      text,
      text_candidates: [],
      image: null,
      image_missing: false,
      choices: choices.map((words, index) => ({
        ...choice(words),
        label: String.fromCharCode(97 + index),
      })),
      key,
    })),
    {
      number: 7,
      // The script's own words: "Perhatikan gambar berikut! …"
      text: "Perhatikan gambar berikut! Gambar mana yang menunjukkan dua magnet saling tarik-menarik?",
      text_candidates: [],
      image: null,
      image_missing: false,
      choices: [
        { ...choice(null, "gambar-1"), label: "a" },
        { ...choice(null, "gambar-2"), label: "b" },
        { ...choice(null, "gambar-3"), label: "c" },
      ],
      key: "c",
    },
  ],
};
