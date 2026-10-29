import { describe, expect, it } from "vite-plus/test";

import { indexMarkdownDocument } from "./indexing";

const document = {
  id: "doc-sop-v1",
  title: "SOP Perjalanan Dinas",
  version: "1.0",
};

describe("indexMarkdownDocument", () => {
  it("creates stable document-scoped ids with legal metadata", () => {
    const markdown = [
      "[Halaman 6]",
      "Pasal 8",
      "(5) Pegawai yang tidak menginap mendapat tiga puluh persen.",
    ].join("\n");

    const first = indexMarkdownDocument(document, markdown);
    const second = indexMarkdownDocument(document, markdown);

    expect(second).toEqual(first);
    expect(first).toContainEqual(
      expect.objectContaining({
        id: "doc-sop-v1-page-6-pasal-8-ayat-5",
        documentId: "doc-sop-v1",
        article: "8 ayat (5)",
        page: 6,
        sequence: 1,
      }),
    );
  });

  it("records a Markdown section for non-legal guidance", () => {
    const chunks = indexMarkdownDocument(
      { ...document, id: "doc-guide" },
      "# Panduan\n\n## Membuat pengajuan\n\nBuka formulir dan isi data.",
    );

    expect(chunks).toEqual([
      expect.objectContaining({
        id: "doc-guide-section-1",
        section: "Membuat pengajuan",
        article: null,
        page: null,
      }),
    ]);
  });

  it("rejects empty Markdown instead of creating an unsearchable ready document", () => {
    expect(() => indexMarkdownDocument(document, " \n\t")).toThrow(
      "The Markdown file has no indexable content.",
    );
  });
});
