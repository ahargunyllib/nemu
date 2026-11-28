/** What Dokumen dan alur needs of a listed document (`listDocuments` with `withPackages`). */
export type KnowledgeItem = {
  id: string;
  title: string;
  format: "pdf" | "md" | "bpmn" | "procedure";
  packageId: string | null;
  isActive: boolean;
  status: "ready" | "failed";
  createdAt: Date;
  updatedAt: Date;
};

/** The list's tabs: written guides (PDF and Markdown), BPMN, and recordings. */
export type KnowledgeTab = "semua" | "pdf" | "bpmn" | "rekaman";

export const KNOWLEDGE_TABS: { value: KnowledgeTab; label: string }[] = [
  { value: "semua", label: "Semua" },
  { value: "pdf", label: "PDF" },
  { value: "bpmn", label: "BPMN" },
  { value: "rekaman", label: "Rekaman" },
];

export function inTab(tab: KnowledgeTab, format: KnowledgeItem["format"]): boolean {
  if (tab === "semua") return true;
  if (tab === "pdf") return format === "pdf" || format === "md";
  if (tab === "bpmn") return format === "bpmn";
  return format === "procedure";
}

/** The short chip before a title: PDF, MD, BPMN, REC. */
export function formatChip(format: KnowledgeItem["format"]): string {
  if (format === "procedure") return "REC";
  return format.toUpperCase();
}

/** "PDF · Paket bawaan", "Rekaman · Sekolah": the kind and whose knowledge it is. */
export function sourceLine(document: Pick<KnowledgeItem, "format" | "packageId">): string {
  const kind =
    document.format === "procedure"
      ? "Rekaman"
      : document.format === "md"
        ? "Markdown"
        : document.format.toUpperCase();
  return `${kind} · ${document.packageId ? "Paket bawaan" : "Sekolah"}`;
}

/** The built-in package first, then the school's own, each oldest first, as Dokumen dan alur lists them. */
export function sortKnowledge<T extends KnowledgeItem>(documents: readonly T[]): T[] {
  return documents.toSorted(
    (a, b) =>
      Number(a.packageId === null) - Number(b.packageId === null) ||
      a.createdAt.getTime() - b.createdAt.getTime(),
  );
}
