import { routeCommand } from "@nemu/ai/school/commands";
import type { TeacherProfile } from "@nemu/ai/school/profile";
import type { SchoolAi } from "@nemu/ai/school/runtime";
import type {
  CommandRoute,
  GroundedAnswer,
  HelpExplanation,
  ScreenSnapshot,
} from "@nemu/contracts/school";

import type { DocumentRepository } from "../documents/repository";
import { loadSchoolKnowledge } from "../school/knowledge";

/** F2 "ini kenapa?" and F3 questions answered only from the school's active knowledge. */

export type HelpDeps = {
  ai: Pick<SchoolAi, "explainError" | "answerGrounded">;
  documents: Pick<DocumentRepository, "listActiveReadyChunks" | "list">;
};

export async function explain(
  deps: HelpDeps,
  teacher: TeacherProfile,
  workspaceId: string,
  input: { snapshot: ScreenSnapshot; question: string | null },
): Promise<HelpExplanation> {
  const kamus = input.snapshot.blocked
    ? []
    : await loadSchoolKnowledge(deps.documents, workspaceId);
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
