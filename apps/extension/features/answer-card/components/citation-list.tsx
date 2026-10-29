import type { Citation } from "@nemu/contracts";
import { Fragment, useState } from "react";

import { describeCitation } from "../lib/citation";
import { CAPTION } from "../lib/typography";
import { TextLink } from "./text-link";

type CitationListProps = {
  citations: readonly Citation[];
  /** The calculations' rate sources, such as the SBM table, after the citations as plain text. */
  sources?: readonly string[];
};

/** "Sumber: PMK 119/2023" as quiet text; a click on a source shows its pasal under the line. */
export function CitationList({ citations, sources = [] }: CitationListProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const open = openIndex === null ? undefined : citations[openIndex];
  const titles = new Set(citations.map((citation) => citation.judul));
  const rateSources = [...new Set(sources)].filter((source) => !titles.has(source));

  const items = [
    ...citations.map((citation, index) => ({
      key: `${citation.doc_id}-${index}`,
      // A button wraps on its own, so nowrap only keeps the comma beside it.
      className: "whitespace-nowrap",
      label: (
        <TextLink
          aria-expanded={openIndex === index}
          className="text-muted-foreground no-underline hover:text-foreground hover:underline aria-expanded:text-foreground"
          onClick={() => setOpenIndex(openIndex === index ? null : index)}
        >
          {citation.judul}
        </TextLink>
      ),
    })),
    ...rateSources.map((source) => ({ key: source, className: undefined, label: source })),
  ];

  if (!items.length) return null;

  return (
    <section aria-label="Sumber" className="flex flex-col gap-1 text-muted-foreground">
      <p>
        Sumber:{" "}
        {items.map((item, index) => (
          <Fragment key={item.key}>
            {index > 0 && " "}
            {/* The comma rides in its source's element, so a wrap never strands it. */}
            <span className={item.className}>
              {item.label}
              {index < items.length - 1 && ","}
            </span>
          </Fragment>
        ))}
      </p>
      {open && (
        <p className={CAPTION}>
          {describeCitation(open)} · Dokumen {open.doc_id}
        </p>
      )}
    </section>
  );
}
