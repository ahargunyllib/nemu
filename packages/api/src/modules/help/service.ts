import { routeCommand } from "@nemu/ai/school/commands";
import type { TeacherProfile } from "@nemu/ai/school/profile";
import type { SchoolAi } from "@nemu/ai/school/runtime";
import type {
  CommandRoute,
  GroundedAnswer,
  HelpExplanation,
  ScreenSnapshot,
} from "@nemu/contracts/school";

import type { CatalogRepository } from "../documents/catalog-repository";
import { toKnowledgeChunks } from "../documents/knowledge-chunks";
import type { DocumentRepository } from "../documents/repository";
import type { KamusRepository } from "../kamus/repository";
import { loadKamusChunks } from "../kamus/service";
import { loadSchoolKnowledge } from "../school/knowledge";

/** F2 "ini kenapa?" from the Kamus Kendala, and F3 questions from the school's active knowledge. */

export type HelpDeps = {
  ai: Pick<SchoolAi, "explainError" | "answerGrounded">;
  documents: Pick<DocumentRepository, "listActiveReadyChunks" | "list">;
  kamus: Pick<KamusRepository, "list">;
};

export async function explain(
  deps: HelpDeps,
  teacher: TeacherProfile,
  workspaceId: string,
  input: { snapshot: ScreenSnapshot; question: string | null },
): Promise<HelpExplanation> {
  const kamus = input.snapshot.blocked ? [] : await loadKamusChunks(deps.kamus, workspaceId);
  return deps.ai.explainError({
    snapshot: input.snapshot,
    question: input.question,
    kamus,
    teacher,
  });
}

export async function ask(
  deps: HelpDeps,
  workspaceId: string,
  question: string,
): Promise<GroundedAnswer> {
  const chunks = await loadSchoolKnowledge(deps.documents, workspaceId);
  return deps.ai.answerGrounded({ question, chunks });
}

/**
 * WS-09 Uji jawaban: the answer a teacher would get if the chosen documents were active, from the
 * same `answerGrounded` that `ask` runs, so activating them changes nothing about the answer.
 */
export async function tryAnswer(
  deps: Pick<HelpDeps, "ai" | "documents"> & {
    catalog: Pick<CatalogRepository, "listReadyChunks">;
  },
  workspaceId: string,
  question: string,
  documentIds: readonly string[],
): Promise<GroundedAnswer> {
  const [active, trial] = await Promise.all([
    loadSchoolKnowledge(deps.documents, workspaceId),
    deps.catalog.listReadyChunks(workspaceId, [...documentIds]),
  ]);
  const seen = new Set(active.map((chunk) => chunk.id));
  const chunks = [...active, ...toKnowledgeChunks(trial).filter((chunk) => !seen.has(chunk.id))];
  return deps.ai.answerGrounded({ question, chunks });
}

/** Which feature a sentence is for; voice controls ("berhenti") are matched first, in code. */
export async function route(
  deps: Pick<HelpDeps, "documents">,
  workspaceId: string,
  utterance: string,
): Promise<CommandRoute> {
  const documents = await deps.documents.list(workspaceId);
  const processes = documents
    .filter(
      (document) => document.format === "bpmn" && document.isActive && document.status === "ready",
    )
    .map((document) => document.title);
  return routeCommand(utterance, processes);
}
