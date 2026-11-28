import { matchShortCommand, words } from "./short-commands";

/** Sounds and polite words that carry no request on their own: "eh", "ya, Nemu". */
const FILLERS = new Set([
  "a",
  "aa",
  "ah",
  "eh",
  "ehm",
  "em",
  "emm",
  "eee",
  "hm",
  "hmm",
  "oh",
  "uh",
  "um",
  "anu",
  "ya",
  "iya",
  "oke",
  "ok",
  "halo",
  "hai",
  "nemu",
  "bu",
  "pak",
  "tolong",
  "coba",
]);

/** Words that make two words a question or a request: "KKM berapa", "isi nilai", "iki kenopo". */
const REQUEST_WORDS = new Set([
  // Questions, in Indonesian and Javanese.
  "apa",
  "apakah",
  "kenapa",
  "mengapa",
  "bagaimana",
  "gimana",
  "kapan",
  "siapa",
  "mana",
  "dimana",
  "berapa",
  "kok",
  "opo",
  "kenopo",
  "piye",
  "endi",
  "sopo",
  "piro",
  "pira",
  // Requests.
  "isi",
  "isikan",
  "masukkan",
  "masukan",
  "buka",
  "periksa",
  "cek",
  "cari",
  "tampilkan",
  "jalankan",
  "rekap",
  "hapus",
  "unggah",
  "kirim",
  "buat",
  "lihat",
  "tunjukkan",
  "jelaskan",
  "bantu",
  "catat",
  "ajari",
]);

/**
 * Whether Nemu should ask the teacher to say it again instead of acting (PRD v2.3): the words are
 * neither a short command nor a question or request. One word, or two without a question or a
 * verb, is too little to act on; three or more is a sentence and goes on.
 */
export function isUnclear(utterance: string): boolean {
  if (matchShortCommand(utterance)) return false;
  const meaningful = words(utterance).filter((word) => !FILLERS.has(word));
  if (meaningful.length >= 3) return false;
  if (meaningful.length < 2) return true;
  return !meaningful.some((word) => REQUEST_WORDS.has(word));
}

/** "Nemu menangkap: “nilai”. Bisa diulang, Bu?" */
export function unclearMessage(utterance: string, honorific: string): string {
  const ask = honorific ? `Bisa diulang, ${honorific}?` : "Bisa diulang?";
  return `Nemu menangkap: “${utterance.trim()}”. ${ask}`;
}
