/**
 * Shared AI building blocks outside the school modules: knowledge retrieval and Rule Sources (the
 * document location each deterministic rule cites). The school AI lives under `./school`.
 */
export { retrieveKnowledge } from "./knowledge.js";
export type { KnowledgeChunk, RankedKnowledgeChunk } from "./knowledge.js";
export {
  defaultRuleSourceLocations,
  isRuleSourceKey,
  resolveRuleSources,
  resolveSourceLocation,
  RULE_SOURCES,
  ruleSourceKeysFor,
} from "./sources.js";
export type { RuleSourceCitations, RuleSourceKey, SourceLocation } from "./sources.js";
