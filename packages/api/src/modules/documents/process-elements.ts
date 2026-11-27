import { importBpmn } from "@nemu/ai/school/bpmn/graph";
import type { SchoolAi } from "@nemu/ai/school/runtime";

import type { ProcessElementRecord } from "./catalog-repository";

/**
 * F3-11 / F3-19: the tasks and end events of an uploaded BPMN, ready for the operator to correct
 * in WS-04. A user task's page starts as its own label (the menu Nemu opens to do it); symptoms
 * are the school AI's suggestion (F3-11), or empty when it has none or fails, until the operator
 * writes them.
 */
export async function bpmnProcessElements(
  documentId: string,
  xml: string,
  ai?: Pick<SchoolAi, "suggestSymptoms">,
): Promise<ProcessElementRecord[]> {
  const graph = await importBpmn(xml);
  let suggested: Record<string, string[]> = {};
  try {
    suggested = ai ? await ai.suggestSymptoms({ graph }) : {};
  } catch (error) {
    console.error("Suggesting BPMN symptoms failed", error);
  }
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
        symptoms: suggested[node.id] ?? [],
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
