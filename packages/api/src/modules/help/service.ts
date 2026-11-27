import { importBpmn } from "@nemu/ai/school/bpmn/graph";
import { routeCommand } from "@nemu/ai/school/commands";
import { describesSymptom, type SymptomCandidate } from "@nemu/ai/school/process-help";
import type { TeacherProfile } from "@nemu/ai/school/profile";
import type { SchoolAi } from "@nemu/ai/school/runtime";
import { NOT_IN_GUIDE_SENTENCE, NOT_IN_PROCESS_SENTENCE } from "@nemu/ai/school/safety";
import type {
  CommandRoute,
  GroundedAnswer,
  HelpExplanation,
  PageSnapshot,
} from "@nemu/contracts/school";

import type { DocumentFileStore } from "../../context";
import type { AlurSekolahConnector } from "../alursekolah/connector";
import type { CatalogRepository } from "../documents/catalog-repository";
import { toKnowledgeChunks } from "../documents/knowledge-chunks";
import type { DocumentRepository } from "../documents/repository";
import type { KamusRepository } from "../kamus/repository";
import { loadKamusRows } from "../kamus/service";
import { loadSchoolKnowledge } from "../school/knowledge";
import { checkSavedGrades } from "./grade-check";

/**
 * F2 "ini kenapa?" from the school's uploaded BPMN symptoms (F2-08) or the Kamus Kendala, and F3
 * questions from the school's active knowledge.
 */

export type HelpDeps = {
  ai: Pick<SchoolAi, "explainError" | "answerGrounded">;
  documents: Pick<DocumentRepository, "listActiveReadyChunks" | "list">;
  kamus: Pick<KamusRepository, "list">;
};

/** What F2-08 needs on top: the WS-04 symptoms, the BPMN files and AlurSekolah (F3-13). */
export type ProcessHelpDeps = {
  ai: Pick<SchoolAi, "matchSymptom" | "explainProcess">;
  catalog: Pick<CatalogRepository, "listProcessElements">;
  files: DocumentFileStore;
  alurSekolah: AlurSekolahConnector;
};

type ExplainInput = { snapshot: PageSnapshot; question: string | null };

/**
 * The teacher's words against every active BPMN's symptoms (operator-corrected in WS-04). On a
 * match, the grades are checked in AlurSekolah first, then the file is walked to the cause.
 * `symptoms` says whether the school has any, for F3-14.
 */
async function explainFromProcess(
  deps: Pick<HelpDeps, "documents"> & ProcessHelpDeps,
  teacher: TeacherProfile,
  workspaceId: string,
  question: string,
): Promise<{ answer: HelpExplanation | null; symptoms: boolean }> {
  const processes = (await deps.documents.list(workspaceId)).filter(
    (document) => document.format === "bpmn" && document.isActive && document.status === "ready",
  );
  const elements = await Promise.all(
    processes.map((document) => deps.catalog.listProcessElements(workspaceId, document.id)),
  );
  const candidates: SymptomCandidate[] = processes.flatMap((document, index) =>
    elements[index]!.flatMap((element) =>
      element.symptoms.map((symptom) => ({
        documentId: document.id,
        elementId: element.elementId,
        symptom,
      })),
    ),
  );
  if (!candidates.length) return { answer: null, symptoms: false };

  const match = await deps.ai.matchSymptom({ question, candidates });
  const document = match && processes.find((item) => item.id === match.documentId);
  const body = document ? await deps.files.get(document.storageKey) : null;
  if (!match || !document || !body) return { answer: null, symptoms: true };

  const [graph, gradeCheck] = await Promise.all([
    importBpmn(new TextDecoder().decode(body)),
    checkSavedGrades(deps.alurSekolah, workspaceId, teacher, `${question} ${match.symptom}`),
  ]);
  const answer = await deps.ai.explainProcess({
    question,
    process: {
      documentId: document.id,
      title: document.title,
      version: document.version,
      graph,
    },
    match,
    gradeCheck,
    teacher,
  });
  return { answer, symptoms: true };
}

export async function explain(
  deps: HelpDeps & { processes?: ProcessHelpDeps },
  teacher: TeacherProfile,
  workspaceId: string,
  input: ExplainInput,
): Promise<HelpExplanation> {
  let symptoms = false;
  if (input.question && deps.processes) {
    const fromProcess = await explainFromProcess(
      { documents: deps.documents, ...deps.processes },
      teacher,
      workspaceId,
      input.question,
    );
    if (fromProcess.answer) return fromProcess.answer;
    symptoms = fromProcess.symptoms;
  }
  const kamus = await loadKamusRows(deps.kamus, workspaceId);
  const explanation = await deps.ai.explainError({
    snapshot: input.snapshot,
    question: input.question,
    kamus,
    teacher,
  });
  // F3-14: she described something, the page shows no error, and no process symptom matches.
  if (
    explanation.status === "not_in_guide" &&
    symptoms &&
    !input.snapshot.alerts.length &&
    describesSymptom(input.question ?? "")
  ) {
    return {
      ...explanation,
      sentence: explanation.sentence.replace(NOT_IN_GUIDE_SENTENCE, NOT_IN_PROCESS_SENTENCE),
    };
  }
  return explanation;
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
      (document) =>
        (document.format === "bpmn" || document.format === "procedure") &&
        document.isActive &&
        document.status === "ready",
    )
    .map((document) => document.title);
  return routeCommand(utterance, processes);
}
