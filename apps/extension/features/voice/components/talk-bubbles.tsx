import { Skeleton } from "@nemu/ui/components/skeleton";
import { NemuBubble, NemuText } from "@nemu/ui/nemu/nemu-frame";

/**
 * While the combination is held (F0-03): one Gelembung headed NEMU MENDENGAR… that tells her how
 * to finish, "Lepas Ctrl + Spasi kalau sudah selesai." The words come only after release, so it
 * shows no transcript. It isn't one of the five display types, so scripts looking for one skip it.
 */
export function ListeningBubble({ keys }: { keys: string }) {
  return (
    <NemuBubble
      display="tunjuk"
      data-nemu-display="mendengar"
      label="Nemu mendengar"
      role="status"
      status={{ text: "Nemu mendengar…" }}
    >
      <NemuText sentence={`Lepas ${keys} kalau sudah selesai.`} />
    </NemuBubble>
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
