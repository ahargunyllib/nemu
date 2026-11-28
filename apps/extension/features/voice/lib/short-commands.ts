/**
 * The short commands a teacher can say while Nemu works (F0-15). The executor (#202) consumes them
 * from `voiceCommands`; Nemu's voice handles "pelan", "ulangi" and "berhenti" itself.
 */
export type ShortCommand = "pelan" | "ulangi" | "ajari_saya" | "lanjut" | "berhenti";

const PHRASES: Record<ShortCommand, readonly string[]> = {
  pelan: [
    "pelan",
    "pelan pelan",
    "pelankan",
    "lebih pelan",
    "pelan sedikit",
    "lambat",
    "lebih lambat",
    "jangan cepat cepat",
  ],
  ulangi: ["ulangi", "ulang", "sekali lagi", "apa tadi", "gimana tadi", "bagaimana tadi"],
  ajari_saya: ["ajari saya", "ajarin saya", "ajarkan saya", "ajari aku", "ajari", "ajarin"],
  lanjut: [
    "lanjut",
    "lanjutkan",
    "teruskan",
    "terus",
    "ayo lanjut",
    "silakan lanjut",
    "saja yang lanjut",
  ],
  berhenti: ["berhenti", "stop", "setop", "cukup", "batal", "sudah", "udah", "diam"],
};

const LOOKUP = new Map<string, ShortCommand>(
  (Object.entries(PHRASES) as [ShortCommand, readonly string[]][]).flatMap(([command, phrases]) =>
    phrases.map((phrase) => [phrase, command] as const),
  ),
);

/** Words around a command that change nothing: "Nemu, tolong ulangi ya." */
const LEADING = new Set(["nemu", "tolong", "coba", "ya", "eh", "oke", "ok", "bu", "pak"]);
const TRAILING = new Set(["ya", "dong", "nemu", "deh", "sih", "lagi", "saja", "aja", "dulu"]);

/** The utterance as lower-case words, punctuation dropped. */
export function words(text: string): string[] {
  return text
    .toLocaleLowerCase("id-ID")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

/**
 * The command a short utterance names, or null. Only the whole utterance counts, so "ulangi
 * pertanyaan saya tentang KKM" is a question, not "ulangi".
 */
export function matchShortCommand(utterance: string): ShortCommand | null {
  const parts = words(utterance);
  while (parts.length > 1 && LEADING.has(parts[0]!)) parts.shift();
  for (;;) {
    const command = LOOKUP.get(parts.join(" "));
    if (command) return command;
    if (parts.length <= 1 || !TRAILING.has(parts.at(-1)!)) return null;
    parts.pop();
  }
}
