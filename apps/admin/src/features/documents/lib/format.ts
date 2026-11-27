export function formatSize(bytes: number) {
  return bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(1)} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const dateFormat = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" });

export function formatDate(date: Date) {
  return dateFormat.format(date);
}

/** "BPMN", "PDF", "Rekaman": what kind of knowledge a document is, in WS-04's words. */
export function formatLabel(format: "pdf" | "md" | "bpmn" | "procedure") {
  if (format === "procedure") return "Rekaman";
  if (format === "md") return "Markdown";
  return format.toUpperCase();
}
