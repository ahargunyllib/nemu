/**
 * The script she picked, as the start card shows it (F4·06): its type on the chip's tile and, for
 * a PDF, how many pages it has. Read from the file itself, with no model call.
 */

/** "naskah.pdf" → "PDF", "soal.docx" → "DOCX", a photo → "FOTO". */
export function fileKind(name: string, mimeType: string): string {
  if (mimeType.startsWith("image/")) return "FOTO";
  const extension = name.match(/\.([a-z0-9]{1,5})$/iu)?.[1];
  return extension ? extension.toUpperCase() : "BERKAS";
}

/**
 * A PDF's page count: the largest /Count of its page tree (the root counts every page), else its
 * /Page objects. Null when neither can be read, such as a page tree inside a compressed object
 * stream; the chip then leaves the pages out rather than guess.
 */
export function pdfPageCount(bytes: Uint8Array): number | null {
  const text = new TextDecoder("latin1").decode(bytes);
  let count = 0;
  for (const object of text.matchAll(/\bobj\b([\s\S]*?)\bendobj\b/gu)) {
    const body = object[1] ?? "";
    if (!/\/Type\s*\/Pages\b/u.test(body)) continue;
    count = Math.max(count, Number(body.match(/\/Count\s+(\d+)/u)?.[1] ?? 0));
  }
  if (count > 0) return count;
  const pages = text.match(/\/Type\s*\/Page(?![a-zA-Z])/gu)?.length ?? 0;
  return pages > 0 ? pages : null;
}

/** The bytes of a `data:` URL, as FileReader gives it. */
export function dataUrlBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

/** "10 soal · 4 halaman" for the chip under the question. */
export function fileMeta(questions: number, pages: number | null): string {
  return pages ? `${questions} soal · ${pages} halaman` : `${questions} soal`;
}
