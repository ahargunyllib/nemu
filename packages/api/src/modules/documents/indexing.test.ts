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

  it("keeps numbered points (3.2) as articles, or as decimal ayat inside a Pasal", () => {
    const sop = indexMarkdownDocument(
      { ...document, id: "sop" },
      [
        "[Halaman 2]",
        "3. Ketentuan penilaian",
        "3.1 Nilai ditulis dalam skala 0 sampai 100.",
        "3.2 KKM adalah 75. Siswa di bawah 75",
        "wajib remedial.",
        "5.1 Guru: menilai. 5.2 Wali kelas: memastikan nilai lengkap.",
      ].join("\n"),
    );
    expect(sop.map(({ id, article, page, text }) => [id, article, page, text])).toEqual([
      [
        "sop-page-2-pasal-3.1",
        "3.1",
        2,
        "3. Ketentuan penilaian\n3.1 Nilai ditulis dalam skala 0 sampai 100.",
      ],
      ["sop-page-2-pasal-3.2", "3.2", 2, "3.2 KKM adalah 75. Siswa di bawah 75\nwajib remedial."],
      ["sop-page-2-pasal-5.1", "5.1", 2, "5.1 Guru: menilai."],
      ["sop-page-2-pasal-5.2", "5.2", 2, "5.2 Wali kelas: memastikan nilai lengkap."],
    ]);

    const legal = indexMarkdownDocument(
      { ...document, id: "tahfidz" },
      "[Halaman 1]\nPasal 3. Setoran hafalan\n3.1 Dua kali seminggu.\n3.2 Paling sedikit 3 ayat.",
    );
    expect(legal.map(({ article }) => article)).toEqual(["3 ayat 3.1", "3 ayat 3.2"]);
  });

  it("leaves amounts at the start of a line alone", () => {
    const chunks = indexMarkdownDocument(
      { ...document, id: "tarif" },
      "[Halaman 1]\nTarif harian\n1.500.000 Jakarta\n2.000.000 Papua",
    );
    expect(chunks.map(({ article }) => article)).toEqual([null]);
  });

  it("rejects empty Markdown instead of creating an unsearchable ready document", () => {
    expect(() => indexMarkdownDocument(document, " \n\t")).toThrow(
      "The Markdown file has no indexable content.",
    );
  });
});
