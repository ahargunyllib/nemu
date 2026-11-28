/**
 * What the top bar's "Cari dokumen, alur, atau langkah" finds, built from the lists the Workspace
 * already loads: the school's documents (WS-04) and each BPMN's tasks and events (F3-11).
 */

type Format = "pdf" | "md" | "bpmn" | "procedure";

export type SearchDocument = {
  id: string;
  title: string;
  fileName: string;
  format: Format;
  status: "ready" | "failed";
};

export type SearchElement = {
  elementId: string;
  kind: "task" | "end" | "event";
  name: string;
};

export type SearchGroup = "Dokumen" | "Alur" | "Langkah";

export type SearchTarget =
  | { to: "/documents"; search: { cari: string } }
  | { to: "/process-diagram"; search: { document: string; path?: string } };

export type SearchResult = {
  /** Unique among the results. */
  value: string;
  /** What the typed words are matched against. */
  keywords: string[];
  group: SearchGroup;
  label: string;
  detail: string;
  target: SearchTarget;
};

/**
 * Whether every typed word appears in the result's words. Plain substrings rather than a fuzzy
 * score, so "setoran" finds "Isi setoran satu kelas" and not every title that has those letters.
 */
export function matchesSearch(keywords: string[], typed: string): boolean {
  const text = keywords.join(" ").toLowerCase();
  return typed
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => text.includes(word));
}

const FORMAT_LABEL: Record<Format, string> = {
  pdf: "PDF",
  md: "Markdown",
  bpmn: "BPMN",
  procedure: "Rekaman",
};

const ELEMENT_LABEL: Record<SearchElement["kind"], string> = {
  task: "Langkah",
  event: "Kejadian",
  end: "Akhir",
};

/** A BPMN that was read opens as its diagram; anything else opens filtered in Dokumen dan alur. */
function documentTarget(document: SearchDocument): SearchTarget {
  if (document.format === "bpmn" && document.status === "ready") {
    return { to: "/process-diagram", search: { document: document.id } };
  }
  return { to: "/documents", search: { cari: document.title } };
}

/** PDFs and Markdown are documents; BPMN processes and recorded procedures are flows (alur). */
export function documentResults(documents: SearchDocument[]): SearchResult[] {
  return documents.map((document) => ({
    value: document.id,
    keywords: [document.title, document.fileName, FORMAT_LABEL[document.format]],
    group: document.format === "bpmn" || document.format === "procedure" ? "Alur" : "Dokumen",
    label: document.title,
    detail: FORMAT_LABEL[document.format],
    target: documentTarget(document),
  }));
}

/** A BPMN's named tasks and events; each opens the diagram with that element outlined. */
export function stepResults(document: SearchDocument, elements: SearchElement[]): SearchResult[] {
  return elements
    .filter((element) => element.name.trim())
    .map((element) => ({
      value: `${document.id}/${element.elementId}`,
      keywords: [element.name, document.title],
      group: "Langkah",
      label: element.name,
      detail: `${ELEMENT_LABEL[element.kind]} · ${document.title}`,
      target: {
        to: "/process-diagram",
        search: { document: document.id, path: element.elementId },
      },
    }));
}
