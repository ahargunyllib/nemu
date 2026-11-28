import { Button } from "@nemu/ui/components/button";
import { Skeleton } from "@nemu/ui/components/skeleton";
import type { GelembungJawabProps } from "@nemu/ui/lib/nemu-display";
import { NEMU_BUTTON, NemuBubble, NemuNoteLinks, NemuText } from "@nemu/ui/nemu/nemu-frame";
import { cn } from "cn";
import { X } from "lucide-react";

/**
 * Gelembung Jawab: an answer or a problem. One sentence with an optional detail line, then one
 * row: the Kenapa?, Sumber and Lihat ringkasan links on the left and at most one compact black
 * action button on the right. A round × closes it.
 */
export function GelembungJawab({
  sentence,
  detail,
  highlightedWord,
  status,
  notes,
  action,
  onRead,
  onClose,
  onRepeat,
}: GelembungJawabProps) {
  return (
    <NemuBubble
      display="jawab"
      label="Jawaban Nemu"
      status={status}
      aria-live="polite"
      // Keep the header and the sentence clear of the × at the top right.
      className={cn(onClose && "[&_[data-nemu-status]]:mr-12")}
    >
      <div className={cn(onClose && !status && "pr-12")}>
        <NemuText
          sentence={sentence}
          detail={detail}
          highlightedWord={highlightedWord}
          onRepeat={onRepeat}
        />
      </div>
      {(notes || action) && (
        <NemuNoteLinks
          notes={notes ?? {}}
          onRead={onRead}
          actions={
            action && (
              <Button type="button" onClick={action.onSelect} className={NEMU_BUTTON}>
                {action.label}
              </Button>
            )
          }
        />
      )}
      {onClose && (
        <Button
          type="button"
          variant="secondary"
          size="icon"
          aria-label="Tutup"
          onClick={onClose}
          className="absolute top-3 right-4 size-11 rounded-full [&_svg:not([class*='size-'])]:size-6"
        >
          <X />
        </Button>
      )}
    </NemuBubble>
  );
}

/** While Nemu reads: a Gelembung Jawab-shaped Skeleton in the answer's place. */
export function GelembungJawabSkeleton() {
  return (
    <NemuBubble display="jawab" label="Nemu sedang membaca" aria-busy>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-full" />
        <Skeleton className="h-7 w-3/4" />
      </div>
      <Skeleton className="h-6 w-40 rounded-full" />
    </NemuBubble>
  );
}
