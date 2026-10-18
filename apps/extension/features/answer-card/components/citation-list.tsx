import type { Citation } from "@nemu/contracts";
import { NemuBadge } from "@nemu/ui/nemu/nemu-badge";
import { BookOpenIcon } from "lucide-react";
import { useState } from "react";

import { describeCitation } from "../lib/citation";
import { CAPTION } from "../lib/typography";

export function CitationList({ citations }: { citations: readonly Citation[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const open = openIndex === null ? undefined : citations[openIndex];

  if (!citations.length) return null;

  return (
    <section aria-label="Sumber" className="flex flex-col gap-1.5">
      <div className="flex flex-wrap gap-1">
        {citations.map((citation, index) => (
          <NemuBadge
            key={`${citation.doc_id}-${index}`}
            tone="subtle"
            render={<button type="button" />}
            aria-expanded={openIndex === index}
            className="h-auto cursor-pointer py-1 text-[11.5px]/[15px] hover:bg-nemu-amber-100"
            onClick={() => setOpenIndex(openIndex === index ? null : index)}
          >
            <BookOpenIcon data-icon="inline-start" />
            {citation.judul}
          </NemuBadge>
        ))}
      </div>
      {open && (
        <p className={`rounded-xl bg-muted px-3 py-2 text-muted-foreground ${CAPTION}`}>
          {describeCitation(open)}
          <br />
          Dokumen: {open.doc_id}
        </p>
      )}
    </section>
  );
}
