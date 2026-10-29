import type { Citation } from "@nemu/contracts";

import { describeCitation } from "../lib/citation";
import { CAPTION } from "../lib/typography";

type SourceLineProps = {
  citations: readonly Citation[];
  /** The calculations' rate sources, such as the SBM table, after the citations. */
  sources?: readonly string[];
};

/** "Sumber: PMK 119/2023 Pasal 8 ayat (5) · SBM TA 2026 …" as quiet text, each source once. */
export function SourceLine({ citations, sources = [] }: SourceLineProps) {
  const titles = new Set(citations.map((citation) => citation.judul));
  const items = [
    ...new Set([
      ...citations.map(describeCitation),
      ...sources.filter((source) => !titles.has(source)),
    ]),
  ];

  if (!items.length) return null;

  return (
    <p role="region" aria-label="Sumber" className={`${CAPTION} text-muted-foreground`}>
      Sumber: {items.join(" · ")}
    </p>
  );
}
