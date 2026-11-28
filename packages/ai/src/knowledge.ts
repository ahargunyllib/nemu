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
    .map((token) =>
      token.length > 5 ? token.replace(/ging$/u, "g").replace(/(?:nya|lah|kah|pun)$/u, "") : token,
    )
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

// An article label such as "3 ayat 3.2" is matched by its numbers only: its structural words would
// otherwise make every point of a Pasal look like it mentions "ayat".
function searchableText(chunk: KnowledgeChunk): string {
  const label = (chunk.article ?? "").replace(/\b(pasal|ayat|huruf|angka|poin|butir)\b/giu, " ");
  return `${chunk.title} ${label} ${chunk.text}`;
}

function calculateIdf(chunks: readonly KnowledgeChunk[]): Map<string, number> {
  const docFreq = new Map<string, number>();
  const activeChunks = chunks.filter((c) => c.active);
  const n = activeChunks.length;

  for (const chunk of activeChunks) {
    const text = searchableText(chunk);
    const uniqueTokens = new Set(tokenize(text));
    for (const token of uniqueTokens) {
      docFreq.set(token, (docFreq.get(token) ?? 0) + 1);
    }
  }

  const idfMap = new Map<string, number>();
  for (const [token, df] of docFreq.entries()) {
    idfMap.set(token, Math.log(1 + (n - df + 0.5) / (df + 0.5)));
  }
  return idfMap;
}

function scoreChunk(
  queryTokens: readonly string[],
  chunk: KnowledgeChunk,
  idfMap: Map<string, number>,
): number {
  const chunkTokens = tokenize(searchableText(chunk));
  const frequencies = new Map<string, number>();

  for (const token of chunkTokens) {
    frequencies.set(token, (frequencies.get(token) ?? 0) + 1);
  }

  let score = 0;
  for (const token of new Set(queryTokens)) {
    const frequency = frequencies.get(token) ?? 0;
    if (frequency > 0) {
      const idf = idfMap.get(token) ?? 1;
      score += idf * (1 + Math.log2(frequency));
    }
  }

  return score;
}

const CITY_TO_PROVINCE: Record<string, string> = {
  balikpapan: "kalimantan timur",
  bandung: "jawa barat",
  denpasar: "bali",
  jakarta: "dki jakarta",
  makassar: "sulawesi selatan",
  manado: "sulawesi utara",
  medan: "sumatera utara",
  semarang: "jawa tengah",
  surabaya: "jawa timur",
  yogyakarta: "di yogyakarta",
  jogja: "di yogyakarta",
};

export function retrieveKnowledge(
  chunks: readonly KnowledgeChunk[],
  query: string,
  limit = 5,
): RankedKnowledgeChunk[] {
  const baseTokens = tokenize(query);
  if (!baseTokens.length || limit < 1) {
    return [];
  }

  const expandedTokens = new Set(baseTokens);
  for (const token of baseTokens) {
    const province = CITY_TO_PROVINCE[token];
    if (province) {
      for (const provToken of tokenize(province)) {
        expandedTokens.add(provToken);
      }
    }
  }

  // Rule questions ask "minimal"/"maksimal"; an SOP writes "paling sedikit"/"paling banyak".
  if (/\b(minimal|minimum|sekurang)/iu.test(query)) {
    for (const t of tokenize("paling sedikit")) expandedTokens.add(t);
  }
  if (/\b(maksimal|maksimum|sebanyak)/iu.test(query)) {
    for (const t of tokenize("paling banyak")) expandedTokens.add(t);
  }
  if (/batal/i.test(query)) {
    for (const t of tokenize("pembatalan dibatalkan surat pernyataan pembebanan pasal 33")) {
      expandedTokens.add(t);
    }
  }
  if (/berangkat/i.test(query)) {
    for (const t of tokenize("keberangkatan tempat kedudukan tempat sah efisiensi")) {
      expandedTokens.add(t);
    }
  }
  if (/\b54\b/i.test(query)) {
    for (const t of tokenize("sbm ta 2026 tahun anggaran 2027 berlaku pmk 32 2025")) {
      expandedTokens.add(t);
    }
  }
  if (/tiket|pesawat/i.test(query)) {
    for (const t of tokenize("tiket pesawat udara pp standar biaya dilampaui")) {
      expandedTokens.add(t);
    }
  }

  const queryTokens = Array.from(expandedTokens);
  const idfMap = calculateIdf(chunks);

  return chunks
    .filter((chunk) => chunk.active)
    .map((chunk) => ({ ...chunk, score: scoreChunk(queryTokens, chunk, idfMap) }))
    .filter((chunk) => chunk.score > 0)
    .sort((left, right) => right.score - left.score || left.id.localeCompare(right.id))
    .slice(0, limit);
}
