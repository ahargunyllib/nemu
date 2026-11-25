import munkres from "munkres";

import type { NameCandidate } from "@nemu/contracts/school";

/**
 * Matches grade-book names to the class roster (F1-04). Deterministic: the roster never goes to a
 * model. Exact, reordered and abbreviated names are accepted; any spelling difference is asked,
 * because the PRD has the teacher confirm "nama beda ejaan" (F1-06).
 */

export type RosterStudent = { studentId: string; name: string; number?: number };

export type NameInput = {
  line: number;
  /** Primary reading. */
  nameRaw: string;
  /** Independent second reading, when there is one. */
  nameAlt?: string | null;
};

export type NameMatch = {
  line: number;
  nameRaw: string;
  studentId: string | null;
  rosterName: string | null;
  score: number;
  status: "auto" | "ask" | "unmatched";
  kind: MatchKind;
  candidates: NameCandidate[];
};

export type MatchKind = "exact" | "reordered" | "abbreviated" | "spelling" | "none";

const FIRST_NAME_VARIANTS: Record<string, string> = {
  muhammad: "m",
  muhamad: "m",
  mohammad: "m",
  mohamad: "m",
  mochammad: "m",
  mochamad: "m",
  muhammmad: "m",
  moch: "m",
  moh: "m",
  muh: "m",
  mhd: "m",
  md: "m",
  achmad: "ahmad",
  ahmat: "ahmad",
  akhmad: "ahmad",
  st: "siti",
};

/** Lowercase, no diacritics or punctuation (keeps the dot of an initial as a separate signal). */
export function canonicalName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/gu, "")
    .toLocaleLowerCase("id-ID")
    .replace(/[^a-z\s.]/gu, " ")
    .replace(/\./gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function tokens(name: string): string[] {
  return canonicalName(name).split(" ").filter(Boolean);
}

/** Folds old spelling and common variants so "Achmad Rizky" and "Ahmad Rizki" score as close. */
export function phoneticToken(token: string): string {
  const variant = FIRST_NAME_VARIANTS[token];
  if (variant) return variant;
  return token
    .replace(/dj/gu, "j")
    .replace(/tj/gu, "c")
    .replace(/oe/gu, "u")
    .replace(/nj/gu, "ny")
    .replace(/sj/gu, "sy")
    .replace(/ch/gu, "kh")
    .replace(/dh/gu, "d")
    .replace(/th/gu, "t")
    .replace(/y$/u, "i")
    .replace(/(.)\1+/gu, "$1");
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(current[j - 1]! + 1, previous[j]! + 1, previous[j - 1]! + cost);
    }
    previous = current;
  }
  return previous[b.length]!;
}

export function jaroWinkler(a: string, b: string): number {
  if (a === b) return 1;
  if (!a.length || !b.length) return 0;
  const window = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);
  const aMatched = new Array<boolean>(a.length).fill(false);
  const bMatched = new Array<boolean>(b.length).fill(false);
  let matches = 0;
  for (let i = 0; i < a.length; i += 1) {
    const start = Math.max(0, i - window);
    const end = Math.min(b.length, i + window + 1);
    for (let j = start; j < end; j += 1) {
      if (bMatched[j] || a[i] !== b[j]) continue;
      aMatched[i] = true;
      bMatched[j] = true;
      matches += 1;
      break;
    }
  }
  if (!matches) return 0;
  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < a.length; i += 1) {
    if (!aMatched[i]) continue;
    while (!bMatched[k]) k += 1;
    if (a[i] !== b[k]) transpositions += 1;
    k += 1;
  }
  const jaro =
    (matches / a.length + matches / b.length + (matches - transpositions / 2) / matches) / 3;
  let prefix = 0;
  while (prefix < 4 && a[prefix] === b[prefix]) prefix += 1;
  return jaro + prefix * 0.1 * (1 - jaro);
}

function tokenSimilarity(a: string, b: string): number {
  const pa = phoneticToken(a);
  const pb = phoneticToken(b);
  if (pa === pb) return a === b ? 1 : 0.97;
  const edit = 1 - levenshtein(pa, pb) / Math.max(pa.length, pb.length);
  return Math.max(jaroWinkler(pa, pb), edit);
}

function isInitialOf(raw: string, full: string): boolean {
  if (raw === full) return false;
  if (FIRST_NAME_VARIANTS[full] === "m" && (raw === "m" || FIRST_NAME_VARIANTS[raw] === "m")) {
    return true;
  }
  return raw.length <= 3 && full.startsWith(raw) && raw.length < full.length;
}

/** Score in 0–1 between a written name and a roster name. */
export function nameScore(raw: string, roster: string): number {
  const rawTokens = tokens(raw);
  const rosterTokens = tokens(roster);
  if (!rawTokens.length || !rosterTokens.length) return 0;

  const used = new Set<number>();
  let total = 0;
  for (const rawToken of rawTokens) {
    let best = 0;
    let bestIndex = -1;
    rosterTokens.forEach((rosterToken, index) => {
      if (used.has(index)) return;
      const similarity = isInitialOf(rawToken, rosterToken)
        ? 0.9
        : tokenSimilarity(rawToken, rosterToken);
      if (similarity > best) {
        best = similarity;
        bestIndex = index;
      }
    });
    if (bestIndex >= 0 && best >= 0.7) {
      used.add(bestIndex);
      total += best;
    }
  }
  const coverage = total / rawTokens.length;
  const missing = rosterTokens.length - used.size;
  const tokenScore = coverage * (1 - 0.05 * missing);

  const rawSorted = [...rawTokens].map(phoneticToken).sort().join(" ");
  const rosterSorted = [...rosterTokens].map(phoneticToken).sort().join(" ");
  const setRatio =
    1 - levenshtein(rawSorted, rosterSorted) / Math.max(rawSorted.length, rosterSorted.length);
  return Math.max(0, Math.min(1, 0.75 * tokenScore + 0.25 * setRatio));
}

/** How a written name relates to a roster name, before any fuzzy scoring. */
export function matchKind(raw: string, roster: string): MatchKind {
  const rawTokens = tokens(raw);
  const rosterTokens = tokens(roster);
  if (!rawTokens.length) return "none";
  if (rawTokens.join(" ") === rosterTokens.join(" ")) return "exact";
  if (
    rawTokens.length === rosterTokens.length &&
    [...rawTokens].sort().join(" ") === [...rosterTokens].sort().join(" ")
  ) {
    return "reordered";
  }
  // Every written token is the roster token at that position, or its initial; trailing roster tokens may be dropped.
  if (rawTokens.length <= rosterTokens.length) {
    const abbreviated = rawTokens.every((token, index) => {
      const full = rosterTokens[index]!;
      return token === full || isInitialOf(token, full);
    });
    const anyFullToken = rawTokens.some(
      (token, index) => token === rosterTokens[index] && token.length > 2,
    );
    if (abbreviated && anyFullToken) return "abbreviated";
  }
  return nameScore(raw, roster) >= 0.6 ? "spelling" : "none";
}

const AUTO_KINDS: ReadonlySet<MatchKind> = new Set(["exact", "reordered", "abbreviated"]);

function rankCandidates(raw: string, roster: readonly RosterStudent[]): NameCandidate[] {
  return roster
    .map((student) => ({
      studentId: student.studentId,
      name: student.name,
      score: nameScore(raw, student.name),
    }))
    .sort((left, right) => right.score - left.score);
}

/**
 * Assigns rows to students one-to-one (Hungarian algorithm), then decides per row whether the
 * teacher has to confirm. A row is auto-accepted only when its name is exact, reordered or a clean
 * abbreviation of exactly one roster name, and the second reading (if any) agrees.
 */
export function matchNames(
  rows: readonly NameInput[],
  roster: readonly RosterStudent[],
): NameMatch[] {
  if (!rows.length) return [];
  const scores = rows.map((row) => roster.map((student) => nameScore(row.nameRaw, student.name)));
  const ORDER_BONUS = 0.03;
  const cost = rows.map((row, rowIndex) =>
    roster.map((student, studentIndex) => {
      const number = student.number ?? studentIndex + 1;
      const bonus = Math.abs(row.line - number) <= 2 ? ORDER_BONUS : 0;
      return 1 - Math.min(1, scores[rowIndex]![studentIndex]! + bonus);
    }),
  );
  const assignment = new Map<number, number>();
  if (roster.length) {
    for (const [rowIndex, studentIndex] of munkres(cost)) assignment.set(rowIndex, studentIndex);
  }

  return rows.map((row, rowIndex) => {
    const candidates = rankCandidates(row.nameRaw, roster).slice(0, 3);
    const assignedIndex = assignment.get(rowIndex);
    const assigned = assignedIndex === undefined ? undefined : roster[assignedIndex];
    const score = assignedIndex === undefined ? 0 : scores[rowIndex]![assignedIndex]!;
    if (!assigned || score < 0.6) {
      return {
        line: row.line,
        nameRaw: row.nameRaw,
        studentId: null,
        rosterName: null,
        score,
        status: "unmatched",
        kind: "none",
        candidates,
      };
    }

    const kind = matchKind(row.nameRaw, assigned.name);
    const ambiguous = roster.some(
      (other) =>
        other.studentId !== assigned.studentId &&
        AUTO_KINDS.has(matchKind(row.nameRaw, other.name)),
    );
    const altDisagrees =
      !!row.nameAlt &&
      canonicalName(row.nameAlt) !== canonicalName(row.nameRaw) &&
      !AUTO_KINDS.has(matchKind(row.nameAlt, assigned.name));
    const auto = AUTO_KINDS.has(kind) && !ambiguous && !altDisagrees;

    const ordered = [
      { studentId: assigned.studentId, name: assigned.name, score },
      ...candidates.filter((candidate) => candidate.studentId !== assigned.studentId),
    ].slice(0, 2);
    return {
      line: row.line,
      nameRaw: row.nameRaw,
      studentId: assigned.studentId,
      rosterName: assigned.name,
      score,
      status: auto ? "auto" : "ask",
      kind,
      candidates: ordered,
    };
  });
}
