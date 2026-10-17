import type { Citation } from "@nemu/contracts";
import { Button } from "@nemu/ui/components/button";
import { BookOpenIcon } from "lucide-react";
import { useState } from "react";

import { describeCitation } from "../lib/citation";

export function CitationList({ citations }: { citations: readonly Citation[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const open = openIndex === null ? undefined : citations[openIndex];

  if (!citations.length) return null;

  return (
    <section aria-label="Sumber" className="flex flex-col gap-1.5">
      <div className="flex flex-wrap gap-1">
        {citations.map((citation, index) => (
          <Button
            key={`${citation.doc_id}-${index}`}
            aria-expanded={openIndex === index}
            size="xs"
            variant="outline"
            onClick={() => setOpenIndex(openIndex === index ? null : index)}
          >
            <BookOpenIcon />
            {citation.judul}
          </Button>
        ))}
      </div>
      {open && (
        <p className="bg-muted px-2 py-1.5 text-muted-foreground">
          {describeCitation(open)}
          <br />
          Dokumen: {open.doc_id}
        </p>
      )}
    </section>
  );
}
