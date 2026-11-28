/** Which files an upload button takes: Dokumen dan alur has one for PDFs and one for BPMN. */
export type UploadKind = "any" | "pdf" | "bpmn";

export type UploadKindConfig = {
  /** The button and dialog title. */
  label: string;
  description: string;
  accept: string;
  pattern: RegExp;
  /** Shown when no file, or a file of another kind, is picked. */
  missing: string;
  wrong: string;
};

export const UPLOAD_KINDS: Record<UploadKind, UploadKindConfig> = {
  any: {
    label: "Unggah dokumen",
    description:
      "PDF, Markdown, atau BPMN. Nemu hanya menjawab dari dokumen aktif; coba dulu di Uji jawaban sebelum mengaktifkan. PDF hasil pindai tanpa lapisan teks tidak bisa dibaca.",
    accept: ".pdf,.md,.markdown,.bpmn,application/pdf,text/markdown,application/xml",
    pattern: /\.(pdf|md|markdown|bpmn)$/i,
    missing: "Pilih file PDF, Markdown, atau BPMN",
    wrong: "Hanya file PDF, Markdown (.md), atau BPMN (.bpmn)",
  },
  pdf: {
    label: "Unggah PDF",
    description:
      "SOP atau panduan sekolah, dalam PDF atau Markdown. Nemu menjawab guru dari isinya selama aktif. PDF hasil pindai tanpa lapisan teks tidak bisa dibaca.",
    accept: ".pdf,.md,.markdown,application/pdf,text/markdown",
    pattern: /\.(pdf|md|markdown)$/i,
    missing: "Pilih file PDF atau Markdown",
    wrong: "Hanya file PDF atau Markdown (.md)",
  },
  bpmn: {
    label: "Unggah BPMN",
    description:
      "Alur kerja dalam BPMN 2.0. Nemu menyusun langkah dari task-nya tanpa ubah kode; periksa halaman tiap task setelah diunggah.",
    accept: ".bpmn,application/xml,text/xml",
    pattern: /\.bpmn$/i,
    missing: "Pilih file BPMN",
    wrong: "Hanya file BPMN (.bpmn)",
  },
};
