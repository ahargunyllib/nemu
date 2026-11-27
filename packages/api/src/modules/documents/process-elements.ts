import { importBpmn } from "@nemu/ai/school/bpmn/graph";
import { indexElements, type ProcessIndex } from "@nemu/ai/school/process-help";
import type { SchoolAi } from "@nemu/ai/school/runtime";

import type { ProcessElementRecord } from "./catalog-repository";

/**
 * F3-11 / F3-19: the tasks, end events and triggering events of an uploaded BPMN, ready for the
 * operator to correct in WS-04. A user task's page starts as its own label (the menu Nemu opens to
 * do it); symptoms, the way back and the role are the school AI's suggestion (F3-11), or empty
 * when it has none or fails, until the operator writes them.
 */
export async function bpmnProcessElements(
  documentId: string,
  xml: string,
  ai?: Pick<SchoolAi, "suggestSymptoms">,
): Promise<ProcessElementRecord[]> {
  const graph = await importBpmn(xml);
  let suggested: ProcessIndex = {};
  try {
    suggested = ai ? await ai.suggestSymptoms({ graph }) : {};
  } catch (error) {
    console.error("Suggesting BPMN symptoms failed", error);
  }
  return indexElements(graph).map((node, sequence) => {
    const userTask = node.bpmnType === "bpmn:UserTask";
    const entry = suggested[node.id];
    return {
      documentId,
      elementId: node.id,
      kind:
        node.kind === "task"
          ? ("task" as const)
          : node.kind === "endEvent"
            ? ("end" as const)
            : ("event" as const),
      name: node.name || node.id,
      sequence,
      symptoms: entry?.symptoms ?? [],
      wayBack: entry?.wayBack ?? null,
      role: entry?.role ?? null,
      page: userTask ? pageFromLabel(node.name) : null,
      pageEdited: false,
    };
  });
}

/** "Isi Form Izin Guru" → "Form Izin Guru": the task label without its leading verb. */
export function pageFromLabel(label: string): string | null {
  const trimmed = label.trim();
  if (!trimmed) return null;
  const withoutVerb = trimmed.replace(
    /^(isi|mengisi|input|masukkan|buka|lihat|cek|periksa|ajukan|unggah|upload|pilih|kirim|setujui|verifikasi)\s+/iu,
    "",
  );
  return withoutVerb || trimmed;
}
