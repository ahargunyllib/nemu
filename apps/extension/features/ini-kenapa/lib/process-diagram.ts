import type { HelpExplanation } from "@nemu/contracts/school";

import { adminUrl } from "../../../shared/lib/config";

type ProcessExplanation = Extract<HelpExplanation, { status: "process" }>;

/**
 * "Lihat diagram" for operators (F2-08): the Admin Workspace page that draws the uploaded BPMN with
 * bpmn-js, the symptom's element highlighted and the steps' elements marked. It needs the
 * operator's sign-in there; the teacher reads the steps in Sumber instead.
 */
export function processDiagramUrl(explanation: ProcessExplanation): string {
  const url = new URL("/process-diagram", adminUrl());
  url.searchParams.set("document", explanation.process.documentId);
  url.searchParams.set("element", explanation.elementId);
  url.searchParams.set(
    "path",
    [...new Set(explanation.steps.flatMap((step) => step.elementIds))].join(","),
  );
  return url.href;
}
