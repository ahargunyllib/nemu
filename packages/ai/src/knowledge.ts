export type KnowledgeChunk = {
  id: string;
  docId: string;
  title: string;
  version: string;
  article?: string;
  page?: number;
  active: boolean;
  text: string;
};

export type RankedKnowledgeChunk = KnowledgeChunk & { score: number };

const STOP_WORDS = new Set([
  "ada",
  "apa",
  "bagaimana",
  "dan",
  "di",
  "dengan",
  "ini",
  "itu",
  "ke",
  "saya",
  "setelah",
  "yang",
]);

function tokenize(value: string): string[] {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLocaleLowerCase("id-ID")
    .split(/[^a-z0-9]+/gu)
    .map((token) => (token.length > 5 ? token.replace(/(?:nya|lah|kah|pun)$/u, "") : token))
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

function scoreChunk(queryTokens: readonly string[], chunk: KnowledgeChunk): number {
  const searchableText = `${chunk.title} ${chunk.article ?? ""} ${chunk.text}`;
  const chunkTokens = tokenize(searchableText);
  const frequencies = new Map<string, number>();

  for (const token of chunkTokens) {
    frequencies.set(token, (frequencies.get(token) ?? 0) + 1);
  }

  let score = 0;
  for (const token of new Set(queryTokens)) {
    const frequency = frequencies.get(token) ?? 0;
    if (frequency > 0) {
      score += 1 + Math.log2(frequency);
    }
  }

  return score;
}

export function retrieveKnowledge(
  chunks: readonly KnowledgeChunk[],
  query: string,
  limit = 5,
): RankedKnowledgeChunk[] {
  const queryTokens = tokenize(query);
  if (!queryTokens.length || limit < 1) {
    return [];
  }

  return chunks
    .filter((chunk) => chunk.active)
    .map((chunk) => ({ ...chunk, score: scoreChunk(queryTokens, chunk) }))
    .filter((chunk) => chunk.score > 0)
    .sort((left, right) => right.score - left.score || left.id.localeCompare(right.id))
    .slice(0, limit);
}
