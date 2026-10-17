import type { Citation } from "@nemu/contracts";

/** "PMK 119/2023, Pasal 8 ayat (5), hlm. 6"; a section like "Bagian 2" keeps its own name. */
export function describeCitation(citation: Citation): string {
  const parts = [citation.judul];
  if (citation.pasal) {
    parts.push(/^\d/.test(citation.pasal) ? `Pasal ${citation.pasal}` : citation.pasal);
  }
  if (citation.halaman) parts.push(`hlm. ${citation.halaman}`);
  return parts.join(", ");
}
