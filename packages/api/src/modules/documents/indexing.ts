import { chunkKnowledgeDocument } from "@nemu/ai/chunking";
import { bpmnKnowledgeTexts, importBpmn } from "@nemu/ai/school/bpmn/graph";
import { extractText } from "unpdf";

import type { NewKnowledgeChunkRecord } from "./repository";

type IndexableDocument = { id: string; title: string; version: string };

function sectionOf(text: string): string | null {
  return text.match(/^#{1,6}\s+(.+)$/mu)?.[1]?.trim() ?? null;
}

export function indexMarkdownDocument(
  document: IndexableDocument,
  markdown: string,
): NewKnowledgeChunkRecord[] {
  const chunks = chunkKnowledgeDocument(
    {
      doc_id: document.id,
      judul: document.title,
      berlaku_untuk: document.version,
      status: "aktif",
    },
    markdown,
  );
  if (chunks.length === 0) {
    throw new Error("The Markdown file has no indexable content.");
  }

  return chunks.map((chunk, sequence) => ({
    id: chunk.id,
    documentId: document.id,
    article: chunk.article ?? null,
    section: sectionOf(chunk.text),
    page: chunk.page ?? null,
    sequence,
    text: chunk.text,
  }));
}

/**
 * Reads a PDF's text layer as Markdown, marking each page the way the knowledge sources do
 * (`[Halaman N]`) so chunks keep their page numbers. A scanned PDF has no text layer.
 */
export async function pdfToMarkdown(bytes: ArrayBuffer): Promise<string> {
  const { text } = await extractText(new Uint8Array(bytes.slice(0)), { mergePages: false });
  if (!text.some((page) => page.trim())) {
    throw new Error(
      "The PDF has no text layer. Scanned PDFs need OCR, which is not supported yet.",
    );
  }
  const pages = withoutRunningLines(text.map((page) => page.trim().split(/\r?\n/u)));
  return pages
    .map((lines, index) => `[Halaman ${index + 1}]\n\n${lines.join("\n").trim()}`)
    .join("\n\n");
}

const runningKey = (line: string) => line.trim().replace(/\d+/gu, "#");

/**
 * Drops a running header or footer ("SOP/AKD/03/2026 - … Halaman 2"): a first or last line of at
 * least four words that, page numbers aside, repeats there on more than half the pages. Left in,
 * it lands in the first point of each page.
 */
function withoutRunningLines(pages: string[][]): string[][] {
  if (pages.length < 2) return pages;
  const edges = pages.map((lines) => {
    const filled = lines.filter((line) => line.trim());
    return new Set([filled[0], filled.at(-1)].flatMap((line) => (line ? [runningKey(line)] : [])));
  });
  const pagesWith = new Map<string, number>();
  for (const keys of edges) {
    for (const key of keys) pagesWith.set(key, (pagesWith.get(key) ?? 0) + 1);
  }
  const running = (key: string) => {
    const count = pagesWith.get(key) ?? 0;
    return key.split(/\s+/u).length >= 4 && count >= 2 && count > pages.length / 2;
  };
  return pages.map((lines, index) =>
    lines.filter((line) => {
      const key = runningKey(line);
      return !edges[index]!.has(key) || !running(key);
    }),
  );
}

/**
 * A BPMN process (F3-03) is indexed as one chunk per task or gateway, so answers and steps can cite
 * "Pengajuan Izin Guru › Isi Form Izin". The XML itself stays in storage for the BPMN walk.
 */
export async function indexBpmnDocument(
  document: IndexableDocument,
  xml: string,
): Promise<NewKnowledgeChunkRecord[]> {
  const graph = await importBpmn(xml);
  const texts = bpmnKnowledgeTexts(graph);
  if (texts.length === 0) throw new Error("The BPMN process has no tasks.");
  return texts.map((item, sequence) => ({
    id: `${document.id}-task-${sequence + 1}`,
    documentId: document.id,
    article: item.article,
    section: graph.name,
    page: null,
    sequence,
    text: item.text,
  }));
}
