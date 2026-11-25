import type { SlotValue } from "@nemu/ai/school/bpmn/conditions";
import { importBpmn } from "@nemu/ai/school/bpmn/graph";
import { planBpmnStep } from "@nemu/ai/school/bpmn/plan";
import {
  instantiateProcedure,
  procedureKnowledgeTexts,
  type ProcedureRun,
} from "@nemu/ai/school/procedures";
import type { TeacherProfile } from "@nemu/ai/school/profile";
import type { SchoolAi } from "@nemu/ai/school/runtime";
import {
  procedureSchema,
  type BpmnPlan,
  type NarrationSegment,
  type Procedure,
  type RecordedEvent,
} from "@nemu/contracts/school";

import type { DocumentFileStore } from "../../context";
import type { DocumentRecord, DocumentRepository } from "../documents/repository";

/**
 * F3: BPMN processes and recorded procedures, both stored as knowledge documents so the existing
 * activate/deactivate and citation flow applies (F3-05, F3-06). Replay and the BPMN walk call no
 * model; only slot extraction from the teacher's sentence and the one-time compile do.
 */

export type ProcessDeps = {
  ai: Pick<SchoolAi, "extractSlots" | "compileProcedure">;
  documents: DocumentRepository;
  files: DocumentFileStore;
};

const TEACHER_LANES = ["Guru", "guru"];

function isUsable(document: DocumentRecord, format: "bpmn" | "procedure"): boolean {
  return document.format === format && document.isActive && document.status === "ready";
}

export async function listProcesses(deps: Pick<ProcessDeps, "documents">, workspaceId: string) {
  const documents = await deps.documents.list(workspaceId);
  return documents
    .filter((document) => isUsable(document, "bpmn"))
    .map((document) => ({
      documentId: document.id,
      title: document.title,
      version: document.version,
    }));
}

export async function processXml(
  deps: Pick<ProcessDeps, "documents" | "files">,
  workspaceId: string,
  documentId: string,
): Promise<string | null> {
  const document = await deps.documents.findById(workspaceId, documentId);
  if (!document || !isUsable(document, "bpmn")) return null;
  const body = await deps.files.get(document.storageKey);
  return body ? new TextDecoder().decode(body) : null;
}

export type PlanProcessInput = {
  documentId: string;
  /** The teacher's sentence ("izin Kamis, anak sakit") or answer to the last question. */
  text: string | null;
  /** The slot the last question was about, when `text` answers it. */
  answering: string | null;
  slots: Record<string, SlotValue>;
  stepIndex: number;
};

export async function planProcess(
  deps: ProcessDeps,
  teacher: TeacherProfile,
  workspaceId: string,
  today: string,
  input: PlanProcessInput,
): Promise<(BpmnPlan & { documentId: string }) | null> {
  const xml = await processXml(deps, workspaceId, input.documentId);
  if (xml === null) return null;
  const graph = await importBpmn(xml);
  let slots = { ...input.slots };
  if (input.text) {
    const extracted = await deps.ai.extractSlots({
      graph,
      teacherLanes: TEACHER_LANES,
      text: input.text,
      today,
      known: slots,
      focus: input.answering,
    });
    slots = { ...slots, ...extracted };
  }
  const plan = planBpmnStep({
    graph,
    slots,
    stepIndex: input.stepIndex,
    honorific: teacher.honorific,
    teacherLanes: TEACHER_LANES,
  });
  return { ...plan, documentId: input.documentId };
}

export function compileRecording(
  deps: Pick<ProcessDeps, "ai">,
  input: { title: string; events: RecordedEvent[]; narration: NarrationSegment[] },
): Promise<Procedure> {
  return deps.ai.compileProcedure(input);
}

/** Stores a reviewed procedure as a "procedure" knowledge document; its steps become citable chunks. */
export async function saveProcedure(
  deps: Pick<ProcessDeps, "documents" | "files">,
  workspaceId: string,
  input: { title: string; version: string; isActive: boolean; procedure: Procedure },
): Promise<DocumentRecord> {
  const id = crypto.randomUUID();
  const storageKey = `${id}.procedure.json`;
  const bytes = new TextEncoder().encode(JSON.stringify(input.procedure));
  await deps.files.put(storageKey, bytes.buffer as ArrayBuffer, "application/json");
  const document = await deps.documents.insert({
    id,
    workspaceId,
    title: input.title,
    version: input.version,
    isActive: false,
    status: "failed",
    failureReason: "The procedure is being indexed.",
    format: "procedure",
    fileName: `${input.title}.json`,
    contentType: "application/json",
    sizeBytes: bytes.byteLength,
    storageKey,
  });
  const chunks = procedureKnowledgeTexts(input.procedure).map((item, sequence) => ({
    id: `${id}-step-${sequence + 1}`,
    documentId: id,
    article: item.article,
    section: input.title,
    page: null,
    sequence,
    text: item.text,
  }));
  return deps.documents.replaceChunksAndSetReady(document.id, chunks, input.isActive);
}

export async function listProcedures(deps: Pick<ProcessDeps, "documents">, workspaceId: string) {
  const documents = await deps.documents.list(workspaceId);
  return documents
    .filter((document) => isUsable(document, "procedure"))
    .map((document) => ({
      documentId: document.id,
      title: document.title,
      version: document.version,
    }));
}

export async function getProcedure(
  deps: Pick<ProcessDeps, "documents" | "files">,
  workspaceId: string,
  documentId: string,
): Promise<Procedure | null> {
  const document = await deps.documents.findById(workspaceId, documentId);
  if (!document || !isUsable(document, "procedure")) return null;
  const body = await deps.files.get(document.storageKey);
  return body ? procedureSchema.parse(JSON.parse(new TextDecoder().decode(body))) : null;
}

export async function runProcedure(
  deps: Pick<ProcessDeps, "documents" | "files">,
  workspaceId: string,
  documentId: string,
  values: Record<string, string>,
): Promise<(ProcedureRun & { title: string }) | null> {
  const procedure = await getProcedure(deps, workspaceId, documentId);
  if (!procedure) return null;
  return { ...instantiateProcedure(procedure, values), title: procedure.title };
}
