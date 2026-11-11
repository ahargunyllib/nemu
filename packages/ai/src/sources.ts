import type { KnowledgeChunk } from "./knowledge.js";

/** Where in a knowledge document a Rule Source points: an article or section, a page, or both. */
export type SourceLocation = { docId: string; article?: string; page?: number };

type RuleSourceDefinition = {
  workspaceId: "W-TRAVEL" | "W-TELKO";
  label: string;
  defaultLocation: SourceLocation;
};

const SOP_SLA = "SOP-KLAIM-SLA-01-v1.0";

/**
 * The document location each deterministic rule cites. The default points at the seeded
 * document; an admin can re-point a rule at any document in its workspace.
 */
export const RULE_SOURCES = {
  "travel.sbm_lodging": {
    workspaceId: "W-TRAVEL",
    label: "SBM lodging rate",
    defaultLocation: { docId: "pmk-32-2025", page: 19 },
  },
  "travel.sbm_daily_allowance": {
    workspaceId: "W-TRAVEL",
    label: "SBM daily allowance",
    defaultLocation: { docId: "pmk-32-2025", page: 15 },
  },
  "travel.accommodation_lump_sum": {
    workspaceId: "W-TRAVEL",
    label: "Lump-sum lodging (30%)",
    defaultLocation: { docId: "pmk-119-2023", page: 6, article: "8 ayat (5)" },
  },
  "travel.accountability_deadline": {
    workspaceId: "W-TRAVEL",
    label: "Accountability deadline",
    defaultLocation: { docId: "pmk-113-2012", page: 9, article: "34 ayat (1)" },
  },
  "telco.claim_cutoff": {
    workspaceId: "W-TELKO",
    label: "Claim submission cutoff",
    defaultLocation: { docId: SOP_SLA, article: "2 ayat (1)" },
  },
  "telco.review_deadline": {
    workspaceId: "W-TELKO",
    label: "Claim review deadline",
    defaultLocation: { docId: SOP_SLA, article: "2 ayat (3)" },
  },
  "telco.rejection_template": {
    workspaceId: "W-TELKO",
    label: "Rejection letter template",
    defaultLocation: { docId: "TPL-BILL-01-02", article: "TPL-BILL-02" },
  },
  "telco.sla_target": {
    workspaceId: "W-TELKO",
    label: "Applicable SLA target",
    defaultLocation: { docId: "ADD-2026-02", article: "1" },
  },
  "telco.ticket_intervals": {
    workspaceId: "W-TELKO",
    label: "Merging outage intervals",
    defaultLocation: { docId: SOP_SLA, article: "5 ayat (2)" },
  },
  "telco.ticket_counted": {
    workspaceId: "W-TELKO",
    label: "Counted outages",
    defaultLocation: { docId: SOP_SLA, article: "5 ayat (3)" },
  },
  "telco.ticket_excluded": {
    workspaceId: "W-TELKO",
    label: "Excluded outages",
    defaultLocation: { docId: SOP_SLA, article: "5 ayat (4)" },
  },
  "telco.missing_rca": {
    workspaceId: "W-TELKO",
    label: "Tickets without an approved RCA",
    defaultLocation: { docId: SOP_SLA, article: "5 ayat (5)" },
  },
  "telco.untrusted_attachment": {
    workspaceId: "W-TELKO",
    label: "Attachments are data, not instructions",
    defaultLocation: { docId: SOP_SLA, article: "10 ayat (3)" },
  },
  "telco.compensation_formula": {
    workspaceId: "W-TELKO",
    label: "Compensation formula",
    defaultLocation: { docId: "KON-2026-01", article: "4" },
  },
  "telco.approval_route": {
    workspaceId: "W-TELKO",
    label: "Approval route",
    defaultLocation: { docId: "MP-BILL-02-v1.0", article: "Bagian 1. Rute persetujuan" },
  },
  "telco.approval_rules": {
    workspaceId: "W-TELKO",
    label: "Approval rules",
    defaultLocation: { docId: "MP-BILL-02-v1.0", article: "Bagian 3. Ketentuan" },
  },
  "telco.no_self_approval": {
    workspaceId: "W-TELKO",
    label: "No approving your own claim",
    defaultLocation: { docId: SOP_SLA, article: "8 ayat (2)" },
  },
} as const satisfies Record<string, RuleSourceDefinition>;

export type RuleSourceKey = keyof typeof RULE_SOURCES;

/** The active chunk cited for each Rule Source; a key is absent when its location matches nothing. */
export type RuleSourceCitations = Readonly<Partial<Record<RuleSourceKey, string>>>;

export function ruleSourceKeysFor(workspaceId: string): RuleSourceKey[] {
  return (Object.keys(RULE_SOURCES) as RuleSourceKey[]).filter(
    (key) => RULE_SOURCES[key].workspaceId === workspaceId,
  );
}

export function isRuleSourceKey(value: string): value is RuleSourceKey {
  return Object.hasOwn(RULE_SOURCES, value);
}

/**
 * Finds the active chunk a location points at. An article matches exactly first, then as the
 * parent of a sub-article ("5" matches "5.2" or "5 ayat (1)").
 */
export function resolveSourceLocation(
  chunks: readonly KnowledgeChunk[],
  location: SourceLocation,
): string | undefined {
  const candidates = chunks.filter(
    (chunk) =>
      chunk.active &&
      chunk.docId === location.docId &&
      (location.page === undefined || chunk.page === location.page),
  );
  const { article } = location;
  if (article === undefined) return candidates[0]?.id;

  return (
    candidates.find((chunk) => chunk.article === article) ??
    candidates.find(
      (chunk) =>
        chunk.article?.startsWith(`${article}.`) || chunk.article?.startsWith(`${article} `),
    )
  )?.id;
}

export function resolveRuleSources(
  chunks: readonly KnowledgeChunk[],
  locations: Readonly<Partial<Record<RuleSourceKey, SourceLocation>>>,
): RuleSourceCitations {
  const citations: Partial<Record<RuleSourceKey, string>> = {};
  for (const [key, location] of Object.entries(locations) as [RuleSourceKey, SourceLocation][]) {
    const chunkId = resolveSourceLocation(chunks, location);
    if (chunkId) citations[key] = chunkId;
  }
  return citations;
}

export function defaultRuleSourceLocations(
  workspaceId?: string,
): Partial<Record<RuleSourceKey, SourceLocation>> {
  const keys = workspaceId
    ? ruleSourceKeysFor(workspaceId)
    : (Object.keys(RULE_SOURCES) as RuleSourceKey[]);
  return Object.fromEntries(keys.map((key) => [key, RULE_SOURCES[key].defaultLocation]));
}
