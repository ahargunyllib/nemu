import type { SlotValue } from "@nemu/ai/school/bpmn/conditions";
import { importBpmn } from "@nemu/ai/school/bpmn/graph";
import { planBpmnStep, type TaskPage } from "@nemu/ai/school/bpmn/plan";
import { imageDataUrl } from "@nemu/ai/school/llm";
import { normalizeControlName } from "@nemu/ai/school/safety";
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
  type FormPhotoResult,
  type FormTable,
  type NarrationSegment,
  type Procedure,
  type RecordedEvent,
} from "@nemu/contracts/school";

import type { DocumentFileStore } from "../../context";
import type { ProcessElementRecord } from "../documents/catalog-repository";
import type { DocumentRecord, DocumentRepository } from "../documents/repository";
import { jobPhoto, type InboxDeps } from "../inbox/service";
import type { SchoolDirectory } from "../school/directory";

/**
 * F3: BPMN processes and recorded procedures, both stored as knowledge documents so the existing
 * activate/deactivate and citation flow applies (F3-05, F3-06). Replay and the BPMN walk call no
 * model; only slot extraction from the teacher's sentence and the one-time compile do.
 */

export type ProcessDeps = {
  ai: Pick<SchoolAi, "extractSlots" | "compileProcedure" | "readFormPhoto" | "matchFields">;
  documents: DocumentRepository;
  files: DocumentFileStore;
  /** WS-04: each BPMN user task's page (F3-19). */
  elements: { list(workspaceId: string, documentId: string): Promise<ProcessElementRecord[]> };
  inbox: InboxDeps["store"];
  directory: SchoolDirectory;
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
  /** F3-16: the photo's rows, checked by the teacher; their columns become one `rows` step. */
  table?: FormTable | null;
};

/** "Klik Al-Quran", "Al-Quran" → the menu path a recording took before its first field. */
function recordingPath(procedure: Procedure): string | null {
  const firstField = procedure.steps.findIndex(
    (step) => step.action === "fill" || step.action === "select",
  );
  const lead = procedure.steps.slice(0, firstField < 0 ? procedure.steps.length : firstField);
  const names = lead
    .filter((step) => step.action === "click" && !step.requiresHumanAction)
    .map((step) => (step.locator.name ?? step.locator.label ?? "").trim())
    .filter(Boolean);
  return names.length ? names.join(" › ") : null;
}

/**
 * F3-19: each teacher task's page. A link in the BPMN wins; then the operator's WS-04 page; then
 * a recording of the task (a procedure titled like it); then the page WS-04 took from the label.
 * A task with none is only explained (cara 3).
 */
export async function taskPages(
  deps: Pick<ProcessDeps, "documents" | "files" | "elements">,
  workspaceId: string,
  documentId: string,
  graph: Awaited<ReturnType<typeof importBpmn>>,
): Promise<Record<string, TaskPage>> {
  const elements = new Map(
    (await deps.elements.list(workspaceId, documentId)).map((element) => [
      element.elementId,
      element,
    ]),
  );
  const recordings: Array<{ title: string; path: string }> = [];
  for (const { documentId: id, title } of await listProcedures(deps, workspaceId)) {
    const procedure = await getProcedure(deps, workspaceId, id);
    const path = procedure ? recordingPath(procedure) : null;
    if (path) recordings.push({ title: normalizeControlName(title), path });
  }
  const pages: Record<string, TaskPage> = {};
  for (const node of Object.values(graph.nodes)) {
    if (node.kind !== "task") continue;
    const element = elements.get(node.id);
    const name = normalizeControlName(node.name);
    const recording = recordings.find(
      (item) => item.title === name || item.title.includes(name) || name.includes(item.title),
    );
    if (node.link) pages[node.id] = { page: node.link, source: "link" };
    else if (element?.page && element.pageEdited)
      pages[node.id] = { page: element.page, source: "mapping" };
    else if (recording) pages[node.id] = { page: recording.path, source: "recording" };
    else if (element?.page) pages[node.id] = { page: element.page, source: "mapping" };
  }
  return pages;
}

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
  const pages = await taskPages(deps, workspaceId, input.documentId, graph);
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
    table: input.table ?? null,
    pages,
  });
  return { ...plan, documentId: input.documentId };
}

export type ReadProcessPhotoInput = {
  documentId: string;
  jobId: string;
  /** The task the plan asked about; its unknown fields are what the photo is read for. */
  taskId: string;
  slots: Record<string, SlotValue>;
};

/**
 * F3-16: the photo in the teacher's inbox read against the task's own fields. The roster is the
 * class a slot names, when it is one of the teacher's classes, so names are matched, not guessed.
 */
export async function readProcessPhoto(
  deps: ProcessDeps,
  teacher: TeacherProfile,
  workspaceId: string,
  input: ReadProcessPhotoInput,
): Promise<FormPhotoResult | null> {
  const xml = await processXml(deps, workspaceId, input.documentId);
  if (xml === null) return null;
  const graph = await importBpmn(xml);
  const task = graph.nodes[input.taskId];
  if (!task || task.kind !== "task") return null;
  const photo = await jobPhoto({ store: deps.inbox }, teacher.teacherId, input.jobId);
  if (!photo) return null;
  const known = (id: string) => {
    const value = input.slots[id];
    return value !== undefined && value !== null && value !== "";
  };
  const fields = task.formFields.filter((field) => field.type !== "file" && !known(field.id));
  const className = Object.values(input.slots).find(
    (value): value is string =>
      typeof value === "string" &&
      teacher.classes.some((item) => item.toUpperCase() === value.toUpperCase()),
  );
  const roster = className ? await deps.directory.roster(teacher.teacherId, className) : [];
  const reading = await deps.ai.readFormPhoto({
    image: { type: "image", dataUrl: imageDataUrl(new Uint8Array(photo.body), photo.contentType) },
    fields,
    roster,
    honorific: teacher.honorific,
  });
  if (reading.status === "reshoot" || !reading.table.rows.length)
    return {
      status: "reshoot",
      message: `Fotonya belum terbaca jelas, ${teacher.honorific}. Kirim ulang fotonya ke WhatsApp Nemu, ya.`,
    };
  const slots: Record<string, SlotValue> = { ...input.slots };
  for (const [id, value] of Object.entries(reading.header)) if (!known(id)) slots[id] = value;
  return {
    status: "ok",
    taskId: task.id,
    slots,
    table: reading.table,
    questions: reading.questions,
  };
}

/** F3-17: each form field's label on this page, for the executor's targets. */
export function matchProcessFields(
  deps: Pick<ProcessDeps, "ai">,
  input: { fields: Array<{ id: string; label: string }>; pageLabels: string[] },
) {
  return deps.ai.matchFields(input);
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
