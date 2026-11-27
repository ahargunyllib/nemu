import { normalizeForQuote } from "./grounding.js";

/**
 * One WS-05 Kamus Kendala row as "ini kenapa?" reads it. `fixer` is the role key the workspace
 * contacts use ("operator", "kepsek", …); "guru" means the teacher can fix it herself.
 */
export type KamusRow = {
  id: string;
  /** How the row is cited: "K-07". */
  code: string;
  app: string;
  /** The message as the page shows it; "…", "...", "*", "{…}" or "[…]" stand for the parts that vary. */
  message: string;
  meaning: string;
  teacherFault: boolean;
  fixer: string;
  /** What the fixer does, as the kamus says it. */
  fix: string;
};

function words(text: string): string {
  return normalizeForQuote(text)
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

const WILDCARD = /…|\.{3,}|\*|\{[^}]*\}|\[[^\]]*\]/u;

function segmentsOf(message: string): string[] {
  return message.split(WILDCARD).map(words).filter(Boolean);
}

function hasInOrder(segments: readonly string[], text: string): boolean {
  const padded = ` ${text} `;
  let from = 0;
  for (const segment of segments) {
    const at = padded.indexOf(` ${segment} `, from);
    if (at < 0) return false;
    from = at + segment.length + 1;
  }
  return true;
}

const SHORT_WORDS = new Set(["dan", "yang", "di", "ke", "dari", "ini", "itu", "anda", "untuk"]);

function contentWords(text: string): Set<string> {
  return new Set(
    words(text)
      .split(" ")
      .filter((word) => word.length >= 3 && !SHORT_WORDS.has(word)),
  );
}

export type KamusMatch =
  | { kind: "exact"; row: KamusRow; errorText: string }
  | { kind: "candidates"; rows: KamusRow[] }
  | { kind: "none" };

/**
 * Deterministic first (AI_TECHNICAL_PRD §5.1): a row matches exactly when every fixed part of its
 * message appears, in order, in one text on the page; the longest such message wins. Otherwise the
 * rows sharing most of their words with the page are candidates for one model call; none shared
 * means no call at all.
 */
export function matchKamus(rows: readonly KamusRow[], texts: readonly string[]): KamusMatch {
  const pageTexts = texts.map((text) => ({ text: text.trim(), words: words(text) }));
  let best: { row: KamusRow; errorText: string; weight: number } | null = null;
  for (const row of rows) {
    const segments = segmentsOf(row.message);
    if (!segments.length) continue;
    const hit = pageTexts.find((page) => hasInOrder(segments, page.words));
    const weight = segments.join(" ").length;
    if (hit && (!best || weight > best.weight)) best = { row, errorText: hit.text, weight };
  }
  if (best) return { kind: "exact", row: best.row, errorText: best.errorText };

  const page = contentWords(texts.join(" "));
  const scored = rows
    .map((row) => {
      const message = contentWords(segmentsOf(row.message).join(" "));
      const shared = [...message].filter((word) => page.has(word)).length;
      return { row, score: message.size ? shared / message.size : 0 };
    })
    .filter((item) => item.score >= 0.3)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  return scored.length
    ? { kind: "candidates", rows: scored.map((item) => item.row) }
    : { kind: "none" };
}

const STOP = String.raw`(?=,|\.|;|\s+(?:lalu|di|dan|untuk|kemudian|kalau)\b|$)`;

/**
 * The control the kamus tells the teacher to press, by the name the page shows: a quoted
 * `tombol "Sinkro Ruang GTK"` first, then a quoted menu, then the words after "tombol"/"menu".
 */
export function guidedTargetOf(fix: string): string | null {
  const patterns = [
    /tombol\s+["“]([^"”]+)["”]/iu,
    /menu\s+["“]([^"”]+)["”]/iu,
    new RegExp(String.raw`tombol\s+(.+?)${STOP}`, "iu"),
    new RegExp(String.raw`menu\s+(.+?)${STOP}`, "iu"),
  ];
  for (const pattern of patterns) {
    const name = fix.match(pattern)?.[1]?.trim();
    if (name) return name;
  }
  return null;
}

const FIXER_SUBJECT =
  /^(?:(?:operator|admin|kepala sekolah|kepsek|bagian keuangan|bendahara|dinas pendidikan|dinas|pengawas|tata usaha)(?:\s+sekolah)?(?:\s*\([^)]*\))?\s+(?:perlu\s+|harus\s+|akan\s+)?)/iu;

/**
 * What the WhatsApp draft asks the fixer for, from the kamus's first fix sentence:
 * "Operator menambahkan penugasan guru …" → "menambahkan penugasan guru …". Null when the sentence
 * doesn't start with the fixer, so the draft falls back to a plain request.
 */
export function requestFromFix(fix: string): string | null {
  const first = fix.split(/(?<=[.!?])\s+/u)[0]?.trim() ?? "";
  if (!FIXER_SUBJECT.test(first)) return null;
  const rest = first
    .replace(FIXER_SUBJECT, "")
    .replace(/[.!?]+$/u, "")
    .trim();
  return rest || null;
}
