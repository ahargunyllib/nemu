import type { GroundedAnswer, SourceCitation } from "@nemu/contracts/school";

import type { AnswerNext } from "../../ini-kenapa/lib/explanation";

/**
 * What the Gelembung Jawab shows for a question: an answer with its sources (and, for "ini
 * kenapa?", the Kenapa? note and one next step), a notice in place of one, or nothing because the
 * teacher said "berhenti". The five display types are #201.
 */
export type AskResult =
  | {
      kind: "answer";
      text: string;
      sources: string[];
      why?: string;
      next?: AnswerNext;
      /** "Lihat diagram" under Sumber, for a BPMN-backed answer (F2-08). */
      diagram?: { label: string; href: string };
    }
  | { kind: "notice"; text: string }
  /** "masukkan nilai UTS Matematika 4B": the grade flow (F1, #207) takes the words. */
  | { kind: "grades"; utterance: string }
  /** "Catat setoran hafalan 4A hari ini": the school's BPMN process runs (F3, #213). */
  | { kind: "process"; utterance: string; processName: string }
  | { kind: "stop" };

/** Grade entry and process runs wait for the executor (#202), whether typed or spoken. */
export const NOT_AVAILABLE_YET =
  "Nemu belum bisa mengisi nilai atau menjalankan proses. Coba tanyakan aturan sekolah, misalnya “KKM berapa?”";

/** "SOP Penilaian SDIT Nusantara · hlm. 2 · 3.2" */
export function sourceLabel(citation: SourceCitation): string {
  return [citation.title, citation.page === null ? null : `hlm. ${citation.page}`, citation.article]
    .filter((part) => part !== null && part !== "")
    .join(" · ");
}

function uniqueSources(citations: readonly SourceCitation[]): string[] {
  return [...new Set(citations.map(sourceLabel))];
}

export function fromGroundedAnswer(answer: GroundedAnswer): AskResult {
  return answer.status === "answered"
    ? { kind: "answer", text: answer.answer, sources: uniqueSources(answer.citations) }
    : { kind: "answer", text: answer.answer, sources: [] };
}
