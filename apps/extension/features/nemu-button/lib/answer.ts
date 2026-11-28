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
      /** The sources Sumber can open: a cited document at its page (#258). */
      files?: SourceFile[];
      /** What the Sumber list comes from, such as a process's title (F2-08). */
      sourcesName?: string;
      /** The sources are a process's steps in order, so Sumber numbers them. */
      sourceSteps?: boolean;
      why?: string;
      /** The Kenapa? card's title: "Kenapa muncul pesan ini?" for a message on the page (F2). */
      whyTitle?: string;
      /** It explains a message on the page, so Nemu points at that message (F2 · 02). */
      aboutMessage?: boolean;
      next?: AnswerNext;
      /** "Lihat diagram (operator)" on the Sumber card, for a BPMN-backed answer (F2-08). */
      diagram?: { label: string; href: string };
    }
  | { kind: "notice"; text: string }
  /** "masukkan nilai UTS Matematika 4B": the grade flow (F1, #207) takes the words. */
  | { kind: "grades"; utterance: string }
  /** "Catat setoran hafalan 4A hari ini": the school's BPMN process runs (F3, #213). */
  | { kind: "process"; utterance: string; processName: string }
  /** "Rekam cara input ujian": the operator records a procedure (F3-01, #214). */
  | { kind: "record"; title: string }
  /** "Nemu, tolong cek kuis ini": F4-01 checks the Moodle quiz on the page (#209). */
  | { kind: "quiz-check"; utterance: string }
  /** "Tolong hapus latihan bahasa Inggris yang kemarin": F4-06 warns before she deletes (#211). */
  | { kind: "quiz-delete"; utterance: string }
  /** "Nemu, masukkan kuis dari naskah ini": F4-03 puts the teacher's script into Moodle (#210). */
  | { kind: "quiz-import"; utterance: string }
  | { kind: "stop" };

/** A cited document by the Sumber label it shows; `page` is where the browser opens it. */
export type SourceFile = { label: string; docId: string; page: number | null };

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

/** Citations with a page come from a PDF's text layer (ADR-0008), so Sumber can open them there. */
function sourceFiles(citations: readonly SourceCitation[]): SourceFile[] {
  const files = new Map<string, SourceFile>();
  for (const citation of citations) {
    const label = sourceLabel(citation);
    if (citation.page !== null && !files.has(label)) {
      files.set(label, { label, docId: citation.docId, page: citation.page });
    }
  }
  return [...files.values()];
}

export function fromGroundedAnswer(answer: GroundedAnswer): AskResult {
  if (answer.status !== "answered") return { kind: "answer", text: answer.answer, sources: [] };
  const files = sourceFiles(answer.citations);
  return {
    kind: "answer",
    text: answer.answer,
    sources: uniqueSources(answer.citations),
    ...(files.length > 0 ? { files } : {}),
  };
}

/** "Rekam cara input ujian tahfidz" → "input ujian tahfidz"; null when it isn't that command. */
export function recordCommand(text: string): string | null {
  const match = text.trim().match(/^(?:nemu[,\s]+)?rekam(?:kan)? cara\b[\s,:]*(.*)$/iu);
  if (!match) return null;
  return (match[1] ?? "").replace(/[.?!]+$/u, "").trim();
}
