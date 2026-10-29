import type { Citation } from "@nemu/contracts";

/** "PMK 119/2023 Pasal 8 ayat (5)"; a section like "Butir 4.1, 4.2" keeps its own name. */
export function describeCitation(citation: Citation): string {
  if (!citation.pasal) return citation.judul;
  const pasal = /^\d/.test(citation.pasal) ? `Pasal ${citation.pasal}` : citation.pasal;
  return `${citation.judul} ${pasal}`;
}
