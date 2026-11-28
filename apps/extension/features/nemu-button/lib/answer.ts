import type { GroundedAnswer, SourceCitation } from "@nemu/contracts/school";
import type { NemuStatus } from "@nemu/ui/lib/nemu-display";

import type { AnswerNext } from "../../ini-kenapa/lib/explanation";
import { whatsAppUrl } from "../../ini-kenapa/lib/whatsapp";

/**
 * What the Gelembung Jawab shows for a question: an answer with its sources (and, for "ini
 * kenapa?", the Kenapa? note and one next step), a notice in place of one, or nothing because the
 * teacher said "berhenti". The five display types are #201.
 */
export type AskResult =
  | {
      kind: "answer";
      text: string;
      /** The heading: "Jawaban" on an answer from the school's guides (F3·09). */
      status?: NemuStatus;
      /** The quieter line under the sentence: the cited rule ("KKM 75 berlaku untuk semua mapel."). */
      detail?: string;
      sources: string[];
      /** The sources Sumber can open: a cited document at its page (#258). */
      files?: SourceFile[];
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
  /** "Rekam cara input ujian": the operator records a procedure (F3-01, #214). */
  | { kind: "record"; title: string }
  /** "Nemu, tolong cek kuis ini": F4-01 checks the Moodle quiz on the page (#209). */
  | { kind: "quiz-check"; utterance: string }
  /** "Tolong hapus latihan bahasa Inggris yang kemarin": F4-06 warns before she deletes (#211). */
  | { kind: "quiz-delete"; utterance: string }
  /** "Nemu, masukkan kuis dari naskah ini": F4-03 puts the teacher's script into Moodle (#210). */
  | { kind: "quiz-import"; utterance: string }
  | { kind: "stop" };

/**
 * A cited document by the Sumber label it shows; `page` is where the browser opens it and
 * `title` is the document's name.
 */
export type SourceFile = { label: string; docId: string; title: string; page: number | null };

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
      files.set(label, {
        label,
        docId: citation.docId,
        title: citation.title,
        page: citation.page,
      });
    }
  }
  return [...files.values()];
}

export function fromGroundedAnswer(answer: GroundedAnswer): AskResult {
  if (answer.status === "not_in_guide") {
    // F3·11: nothing invented; who can answer, and her question ready for the operator.
    return {
      kind: "answer",
      text: answer.answer,
      status: { text: "Belum ada", tone: "muted" },
      ...(answer.detail ? { detail: answer.detail } : {}),
      sources: [],
      ...(answer.waDraft
        ? {
            next: { kind: "whatsapp", label: "Siapkan pesan WA", url: whatsAppUrl(answer.waDraft) },
          }
        : {}),
    };
  }
  const files = sourceFiles(answer.citations);
  return {
    kind: "answer",
    text: answer.answer,
    status: { text: "Jawaban" },
    ...(answer.detail ? { detail: answer.detail } : {}),
    sources: uniqueSources(answer.citations),
    ...(files.length > 0 ? { files } : {}),
  };
}

/**
 * F3·09: an answer whose sources are all in one document Nemu can open gets one link straight to
 * the first cited page (points 3.2 and 3.4 of the SOP Penilaian open at page 2). Sources from
 * several documents, a source with no file, or a process's steps and diagram (F2-08) keep the
 * Sumber list.
 */
export function singleSourceFile(
  result: Pick<Extract<AskResult, { kind: "answer" }>, "sources" | "files" | "diagram">,
): SourceFile | null {
  const files = result.files ?? [];
  const first = files[0];
  if (!first || result.diagram) return null;
  if (files.some((file) => file.docId !== first.docId)) return null;
  const opens = new Set(files.map((file) => file.label));
  return result.sources.every((source) => opens.has(source)) ? first : null;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

/**
 * "Sumber: SOP Penilaian, hlm. 2": the document's name without the school's, which the teacher
 * already knows, and the page it opens at.
 */
export function sourceLinkLabel(file: SourceFile, schoolName?: string | null): string {
  const school = schoolName?.trim();
  const short = school
    ? file.title
        .replace(new RegExp(escapeRegExp(school), "iu"), " ")
        .replace(/\s+/gu, " ")
        .trim()
    : "";
  const name = short || file.title;
  return `Sumber: ${file.page === null ? name : `${name}, hlm. ${file.page}`}`;
}

/** "Rekam cara input ujian tahfidz" → "input ujian tahfidz"; null when it isn't that command. */
export function recordCommand(text: string): string | null {
  const match = text.trim().match(/^(?:nemu[,\s]+)?rekam(?:kan)? cara\b[\s,:]*(.*)$/iu);
  if (!match) return null;
  return (match[1] ?? "").replace(/[.?!]+$/u, "").trim();
}
