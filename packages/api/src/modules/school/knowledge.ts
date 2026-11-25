import type { KnowledgeChunk } from "@nemu/ai";
import type { SchoolRuleCitations } from "@nemu/ai/school/grades/rules";
import type { SchoolRuleKey } from "@nemu/contracts/school";

import { toKnowledgeChunks } from "../documents/knowledge-chunks";
import type { DocumentRepository } from "../documents/repository";
import type { RuleSourceRepository } from "../rule-sources/repository";
import { resolveWorkspaceRuleSources } from "../rule-sources/service";

/** The workspace's active knowledge as the AI cites it: SOP, kamus kendala, BPMN tasks, procedures. */
export async function loadSchoolKnowledge(
  documents: Pick<DocumentRepository, "listActiveReadyChunks">,
  workspaceId: string,
): Promise<KnowledgeChunk[]> {
  return toKnowledgeChunks(await documents.listActiveReadyChunks(workspaceId));
}

const SCHOOL_RULE_KEYS: readonly SchoolRuleKey[] = [
  "school.kkm",
  "school.remedial_cap",
  "school.absence_blank",
  "school.input_deadline",
];

/** Each school rule's active citation, honouring the admin's Rule Source choices (ADR-0007). */
export async function schoolRuleCitations(
  deps: {
    documents: Pick<DocumentRepository, "listActiveReadyChunks">;
    ruleSources: Pick<RuleSourceRepository, "list">;
  },
  workspaceId: string,
): Promise<SchoolRuleCitations> {
  const [overrides, chunks] = await Promise.all([
    deps.ruleSources.list(workspaceId),
    deps.documents.listActiveReadyChunks(workspaceId),
  ]);
  const citations = resolveWorkspaceRuleSources(workspaceId, overrides, toKnowledgeChunks(chunks));
  const result: Partial<Record<SchoolRuleKey, string>> = {};
  for (const key of SCHOOL_RULE_KEYS) {
    const chunkId = citations[key];
    if (chunkId) result[key] = chunkId;
  }
  return result;
}
