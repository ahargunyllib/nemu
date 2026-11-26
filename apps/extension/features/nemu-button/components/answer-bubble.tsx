import { Button } from "@nemu/ui/components/button";
import { Skeleton } from "@nemu/ui/components/skeleton";
import { NemuBadge } from "@nemu/ui/nemu/nemu-badge";
import { X } from "lucide-react";
import type { ReactNode } from "react";

type BubbleFrameProps = {
  label: string;
  onClose?: () => void;
  children: ReactNode;
};

/** The Gelembung Jawab: a white card above the Nemu button (docs/design-system.md, Jawaban teks). */
function BubbleFrame({ label, onClose, children }: BubbleFrameProps) {
  return (
    <section
      aria-label={label}
      aria-live="polite"
      className="relative flex w-[300px] flex-col gap-2.5 rounded-2xl border bg-background py-3 pr-9 pl-3.5 text-sm text-foreground shadow-nemu-float"
    >
      {children}
      {onClose && (
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label="Tutup"
          onClick={onClose}
          className="absolute top-2 right-2 text-muted-foreground"
        >
          <X />
        </Button>
      )}
    </section>
  );
}

/** `children` replaces the plain text, e.g. with the spoken text and its word highlight. */
export function AnswerBubble({
  text,
  sources = [],
  onClose,
  children,
}: {
  text: string;
  sources?: readonly string[];
  onClose?: () => void;
  children?: ReactNode;
}) {
  return (
    <BubbleFrame label="Jawaban Nemu" onClose={onClose}>
      {children ?? <p className="whitespace-pre-line">{text}</p>}
      {sources.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {sources.map((source) => (
            <NemuBadge key={source} tone="subtle" className="h-auto whitespace-normal text-left">
              {source}
            </NemuBadge>
          ))}
        </div>
      )}
    </BubbleFrame>
  );
}

/** While Nemu reads: a bubble-shaped Skeleton in the answer's place. */
export function AnswerBubbleSkeleton() {
  return (
    <BubbleFrame label="Nemu sedang membaca">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-4/5" />
      <Skeleton className="h-5 w-40 rounded-full" />
    </BubbleFrame>
  );
}
