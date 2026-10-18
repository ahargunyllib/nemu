import type { Citation } from "@nemu/contracts";
import { Fragment, useState } from "react";

import { describeCitation } from "../lib/citation";
import { CAPTION } from "../lib/typography";
import { TextLink } from "./text-link";

/** "Sumber: PMK 119/2023" as quiet text; a click on a source shows its pasal under the line. */
export function CitationList({ citations }: { citations: readonly Citation[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const open = openIndex === null ? undefined : citations[openIndex];

  if (!citations.length) return null;

  return (
    <section aria-label="Sumber" className="flex flex-col gap-1 text-muted-foreground">
      <p>
        Sumber:{" "}
        {citations.map((citation, index) => (
          <Fragment key={`${citation.doc_id}-${index}`}>
            {index > 0 && ", "}
            <TextLink
              aria-expanded={openIndex === index}
              className="text-muted-foreground no-underline hover:text-foreground hover:underline aria-expanded:text-foreground"
              onClick={() => setOpenIndex(openIndex === index ? null : index)}
            >
              {citation.judul}
            </TextLink>
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
