import { importBpmn } from "@nemu/ai/school/bpmn/graph";

import type { ProcessElementRecord } from "./catalog-repository";

/**
 * F3-11 / F3-19: the tasks and end events of an uploaded BPMN, ready for the operator to correct
 * in WS-04. A user task's page starts as its own label (the menu Nemu opens to do it); symptoms
 * start empty until the school AI (#217) suggests them or the operator writes them.
 */
export async function bpmnProcessElements(
  documentId: string,
  xml: string,
): Promise<ProcessElementRecord[]> {
  const graph = await importBpmn(xml);
  return Object.values(graph.nodes)
    .filter((node) => node.kind === "task" || node.kind === "endEvent")
    .map((node, sequence) => {
      const userTask = node.bpmnType === "bpmn:UserTask";
      return {
        documentId,
        elementId: node.id,
        kind: node.kind === "task" ? ("task" as const) : ("end" as const),
        name: node.name || node.id,
        sequence,
        symptoms: [],
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
