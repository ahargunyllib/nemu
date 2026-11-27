import { Button } from "@nemu/ui/components/button";
import { Skeleton } from "@nemu/ui/components/skeleton";
import type { GelembungJawabProps } from "@nemu/ui/lib/nemu-display";
import { BIG_BUTTON, NemuBubble, NemuNoteLinks, NemuSentence } from "@nemu/ui/nemu/nemu-frame";
import { cn } from "cn";
import { X } from "lucide-react";

/**
 * Gelembung Jawab: an answer or a problem. One sentence, the Kenapa?, Sumber and Lihat ringkasan
 * links, and at most one action button in Nemu's dark orange.
 */
export function GelembungJawab({
  sentence,
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
      className={cn(onClose && "[&_[data-nemu-status]]:mr-16")}
    >
      <div className={cn(onClose && !status && "pr-10")}>
        <NemuSentence sentence={sentence} highlightedWord={highlightedWord} onRepeat={onRepeat} />
      </div>
      {notes && <NemuNoteLinks notes={notes} onRead={onRead} />}
      {action && (
        <Button
          type="button"
          onClick={action.onSelect}
          className={cn(
            BIG_BUTTON,
            "w-full bg-nemu-strong text-nemu-strong-foreground hover:bg-nemu-strong hover:brightness-90",
          )}
        >
          {action.label}
        </Button>
      )}
      {onClose && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Tutup"
          onClick={onClose}
          className="absolute top-1.5 right-1.5 size-11 text-foreground [&_svg:not([class*='size-'])]:size-6"
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
