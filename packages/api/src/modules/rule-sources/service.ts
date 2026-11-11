import {
  defaultRuleSourceLocations,
  isRuleSourceKey,
  resolveRuleSources,
  RULE_SOURCES,
  ruleSourceKeysFor,
  type RuleSourceCitations,
  type RuleSourceKey,
  type SourceLocation,
} from "@nemu/ai";

import { toKnowledgeChunks } from "../documents/knowledge-chunks";
import type { DocumentRepository } from "../documents/repository";
import type { RuleSourceRecord, RuleSourceRepository } from "./repository";

export type RuleSourceDeps = {
  ruleSources: RuleSourceRepository;
  documents: Pick<DocumentRepository, "list" | "findById" | "listActiveReadyChunks">;
};

export type RuleSourceView = {
  key: RuleSourceKey;
  label: string;
  documentId: string;
  documentTitle: string | null;
  article: string | null;
  page: number | null;
  isDefault: boolean;
  citationId: string | null;
};

export type SetRuleSourceInput = {
  key: string;
  documentId: string;
  article?: string;
  page?: number;
};

/** Each of the workspace's rules at its admin-chosen location, or its default when none is set. */
export function ruleSourceLocations(
  workspaceId: string,
  overrides: readonly RuleSourceRecord[],
): Partial<Record<RuleSourceKey, SourceLocation>> {
  const locations = defaultRuleSourceLocations(workspaceId);
  for (const override of overrides) {
    if (!isRuleSourceKey(override.key) || !(override.key in locations)) continue;
    locations[override.key] = {
      docId: override.documentId,
      ...(override.article ? { article: override.article } : {}),
      ...(override.page === null ? {} : { page: override.page }),
    };
  }
  return locations;
}

export function resolveWorkspaceRuleSources(
  workspaceId: string,
  overrides: readonly RuleSourceRecord[],
  chunks: Parameters<typeof resolveRuleSources>[0],
): RuleSourceCitations {
  return resolveRuleSources(chunks, ruleSourceLocations(workspaceId, overrides));
}

export async function listRuleSources(
  { ruleSources, documents }: RuleSourceDeps,
  workspaceId: string,
): Promise<RuleSourceView[]> {
  const [overrides, workspaceDocuments, chunks] = await Promise.all([
    ruleSources.list(workspaceId),
    documents.list(workspaceId),
    documents.listActiveReadyChunks(workspaceId),
  ]);
  const locations = ruleSourceLocations(workspaceId, overrides);
  const citations = resolveRuleSources(toKnowledgeChunks(chunks), locations);
  const titles = new Map(workspaceDocuments.map((document) => [document.id, document.title]));
  const overridden = new Set(overrides.map((override) => override.key));

  return ruleSourceKeysFor(workspaceId).map((key) => {
    const location: SourceLocation = locations[key] ?? RULE_SOURCES[key].defaultLocation;
    return {
      key,
      label: RULE_SOURCES[key].label,
      documentId: location.docId,
      documentTitle: titles.get(location.docId) ?? null,
      article: location.article ?? null,
      page: location.page ?? null,
      isDefault: !overridden.has(key),
      citationId: citations[key] ?? null,
    };
  });
}

export async function setRuleSource(
  { ruleSources, documents }: RuleSourceDeps,
  workspaceId: string,
  { key, documentId, article, page }: SetRuleSourceInput,
): Promise<"saved" | "rule_not_found" | "document_not_found"> {
  if (!ruleSourceKeysFor(workspaceId).some((candidate) => candidate === key)) {
    return "rule_not_found";
  }
  if (!(await documents.findById(workspaceId, documentId))) return "document_not_found";

  await ruleSources.upsert({
    workspaceId,
    key,
    documentId,
    article: article || null,
    page: page ?? null,
  });
  return "saved";
}

export function resetRuleSource(
  { ruleSources }: Pick<RuleSourceDeps, "ruleSources">,
  workspaceId: string,
  key: string,
) {
  return ruleSources.delete(workspaceId, key);
}
