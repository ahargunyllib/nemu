import type { GroundedAnswer, HelpExplanation, SourceCitation } from "@nemu/contracts/school";

/**
 * What the Gelembung Jawab shows for a typed question: an answer with its sources, a notice in
 * place of one, or nothing because the teacher said "berhenti". The five display types are #201.
 */
export type AskResult =
  | { kind: "answer"; text: string; sources: string[] }
  | { kind: "notice"; text: string }
  | { kind: "stop" };

/** Grade entry and process runs start from voice and the executor (#200, #202), not the type box. */
export const NOT_FROM_TYPING_YET =
  "Nemu belum bisa mengerjakan ini dari kotak ketik. Coba tanyakan aturan sekolah, misalnya “KKM berapa?”";

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

export function fromExplanation(explanation: HelpExplanation): AskResult {
  return explanation.status === "matched"
    ? { kind: "answer", text: explanation.sentence, sources: [sourceLabel(explanation.citation)] }
    : { kind: "answer", text: explanation.sentence, sources: [] };
}
