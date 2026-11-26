import { Skeleton } from "@nemu/ui/components/skeleton";

/** While the combination is held: a red dot and "Nemu mendengar…" (F0-03). */
export function ListeningBubble() {
  return (
    <div
      role="status"
      className="flex items-center gap-2 rounded-full bg-background px-3.5 py-2 text-sm text-foreground shadow-nemu-float"
    >
      <span aria-hidden className="size-2.5 animate-pulse rounded-full bg-destructive" />
      Nemu mendengar…
    </div>
  );
}

/**
 * What Nemu heard, shown before it acts (F0-04); a text-shaped Skeleton while it is transcribed.
 * #201 replaces this look.
 */
export function HeardBubble({ text }: { text: string | null }) {
  return (
    <section
      aria-label="Yang Nemu dengar"
      aria-live="polite"
      className="max-w-[300px] rounded-2xl rounded-br-md bg-nemu-subtle px-3.5 py-2 text-sm text-nemu-subtle-foreground shadow-nemu-float"
    >
      {text === null ? <Skeleton className="h-4 w-40" /> : `“${text}”`}
    </section>
  );
}
