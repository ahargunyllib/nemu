import { Skeleton } from "@nemu/ui/components/skeleton";

/** While the combination is held: a red dot and "Nemu mendengar…" (F0-03). */
export function ListeningBubble() {
  return (
    <div
      role="status"
      className="flex items-center gap-2.5 rounded-full bg-background px-4 py-2.5 text-lg font-medium text-foreground shadow-nemu-float"
    >
      <span aria-hidden className="size-3 animate-pulse rounded-full bg-destructive" />
      Nemu mendengar…
    </div>
  );
}

/**
 * What Nemu heard, shown before it acts (F0-04); a text-shaped Skeleton while it is transcribed.
 * An echo of the teacher's words, not one of the five display types.
 */
export function HeardBubble({ text }: { text: string | null }) {
  return (
    <section
      aria-label="Yang Nemu dengar"
      aria-live="polite"
      className="max-w-[420px] rounded-3xl rounded-br-lg bg-nemu-subtle px-4 py-2.5 text-xl text-nemu-subtle-foreground shadow-nemu-float"
    >
      {text === null ? <Skeleton className="h-6 w-48" /> : `“${text}”`}
    </section>
  );
}
