/**
 * Code-level guardrails for v2.2. Nemu never presses an irreversible button (F0-08), never asks for a
 * password or authenticator code (F2-07), and speaks one short sentence without the word "salah" (F0-10).
 */

const DENIED_ACTION_WORDS = [
  "simpan",
  "kirim",
  "ajukan",
  "hapus",
  "submit",
  "save",
  "send",
  "delete",
  "setujui",
  "tolak",
  "selesaikan",
  "finalisasi",
  "kunci",
  "publish",
  "terbitkan",
  "unggah",
  "upload",
  "bayar",
  "konfirmasi",
  "keluar",
  "logout",
] as const;

const DENIED_EXACT_NAMES = new Set(["ya", "ok", "oke"]);

export function normalizeControlName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/gu, "")
    .toLocaleLowerCase("id-ID")
    .replace(/[^a-z0-9 ]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

/** True for a control Nemu must leave to the teacher, matched on its accessible name. */
export function isDeniedActionName(name: string | null | undefined): boolean {
  if (!name) return false;
  const normalized = normalizeControlName(name);
  if (DENIED_EXACT_NAMES.has(normalized)) return true;
  const words = new Set(normalized.split(" "));
  return DENIED_ACTION_WORDS.some((word) => words.has(word));
}

const SECRET_REQUEST =
  /\b(kata\s*sandi|password|sandi|pin|otp|kode\s*(otp|verifikasi|autentikator|authenticator|akses|keamanan)|autentikator|authenticator)\b/iu;

/** True when a sentence mentions a password or authenticator code (Nemu must never ask for one). */
export function mentionsSecret(text: string): boolean {
  return SECRET_REQUEST.test(text);
}

export type SentenceIssue = "says_salah" | "too_many_sentences" | "too_long" | "mentions_secret";

/** Checks a bubble/voice sentence against F0-10. */
export function sentenceIssues(text: string, maxWords = 14): SentenceIssue[] {
  const issues: SentenceIssue[] = [];
  if (/\bsalah\b/iu.test(text)) issues.push("says_salah");
  const sentences = text
    .split(/(?<=[.!?])\s+/u)
    .map((part) => part.trim())
    .filter(Boolean);
  if (sentences.length > 2) issues.push("too_many_sentences");
  if (text.split(/\s+/u).filter(Boolean).length > maxWords) issues.push("too_long");
  if (mentionsSecret(text)) issues.push("mentions_secret");
  return issues;
}

export const NOT_IN_GUIDE_SENTENCE = "Belum ada di panduan sekolah.";
