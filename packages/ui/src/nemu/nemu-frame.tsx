import { Button } from "@nemu/ui/components/button";
import { Card } from "@nemu/ui/components/card";
import { Progress } from "@nemu/ui/components/progress";
import {
  NOTE_LABELS,
  type NemuNoteKind,
  type NemuNotes,
  type NemuStatus,
  noteText,
  sourceName,
  statusText,
} from "@nemu/ui/lib/nemu-display";
import { cn } from "cn";
import { CircleAlert, CircleCheck, PencilLine } from "lucide-react";
import { type ComponentProps, Fragment, useState } from "react";

/*
 * The building blocks the five display types share (PRD §6.2). Sizes: bubble text 24 px, card
 * text 20 px, every button at least 44 px. Contrast: text is `foreground` on white, or
 * `nemu-strong` (amber 800) on white or `nemu-subtle`, all at least 7:1.
 */

/** A big button in a bubble or card: 48 px tall, 20 px text, 24 px icons. */
export const BIG_BUTTON =
  "h-12 min-h-11 gap-2 rounded-2xl border-2 px-5 text-xl font-semibold [&_svg:not([class*='size-'])]:size-6";

type NemuBubbleProps = ComponentProps<typeof Card> & {
  /** Which of the five it is, for the page's own scripts and tests. */
  display: "kerja" | "tunjuk" | "jawab";
  label: string;
  status?: NemuStatus;
};

/** A Gelembung: a rounded bubble with Nemu's dark orange edge. */
export function NemuBubble({
  display,
  label,
  status,
  className,
  children,
  ...props
}: NemuBubbleProps) {
  return (
    <Card
      role="region"
      aria-label={label}
      data-nemu-display={display}
      className={cn(
        "relative w-[420px] max-w-[calc(100vw-16px)] gap-4 rounded-3xl py-5 text-2xl text-foreground shadow-nemu-float ring-2 ring-nemu",
        className,
      )}
      {...props}
    >
      {status && <NemuStatusHeader status={status} />}
      <div className="flex flex-col gap-4 px-5">{children}</div>
    </Card>
  );
}

type NemuCardProps = ComponentProps<typeof Card> & {
  display: "pilih" | "info";
  label: string;
};

/** A Kartu: a card with a dark orange band along its top, for deciding or reading. */
export function NemuCard({ display, label, className, children, ...props }: NemuCardProps) {
  return (
    <Card
      role="region"
      aria-label={label}
      data-nemu-display={display}
      className={cn(
        "w-[400px] max-w-[calc(100vw-16px)] gap-5 pt-0 pb-5 text-xl text-foreground shadow-nemu-float [--card-spacing:--spacing(5)]",
        className,
      )}
      {...props}
    >
      <div aria-hidden className="h-2 bg-nemu" />
      {children}
    </Card>
  );
}

const STATUS_ICONS = { working: PencilLine, unsaved: CircleAlert, saved: CircleCheck };

/**
 * The bubble header: "Nemu mengisi · 13 dari 32", "Belum tersimpan", "Tersimpan", with a
 * progress bar. It is never read aloud; the icon and the words carry the state, not the colour.
 */
export function NemuStatusHeader({ status }: { status: NemuStatus }) {
  const Icon = STATUS_ICONS[status.tone];
  const text = statusText(status);
  const progress = status.progress;
  return (
    <div
      data-nemu-status={status.tone}
      className="mx-5 flex flex-col gap-2 rounded-2xl bg-nemu-subtle px-4 py-2.5 text-lg font-semibold text-nemu-strong"
    >
      <p className="flex items-center gap-2">
        <Icon aria-hidden className="size-5 shrink-0" />
        {text}
      </p>
      {progress && (
        <Progress
          value={progress.total > 0 ? (progress.done / progress.total) * 100 : 0}
          aria-label={text}
          className="[&_[data-slot=progress-indicator]]:bg-nemu [&_[data-slot=progress-track]]:h-2 [&_[data-slot=progress-track]]:bg-nemu-amber-100"
        />
      )}
    </div>
  );
}

/**
 * Nemu's one sentence at 24 px. While Nemu's voice reads it (#200), the word it is on is marked
 * with a tint and a thick underline; with `onRepeat`, clicking it says it again.
 */
export function NemuSentence({
  sentence,
  highlightedWord,
  onRepeat,
}: {
  sentence: string;
  highlightedWord?: number;
  /** Makes the sentence a button that says it again. */
  onRepeat?: () => void;
}) {
  let word = -1;
  const words = (
    <>
      {sentence.split(/(\s+)/u).map((part, index) => {
        if (part.trim() === "") return <Fragment key={index}>{part}</Fragment>;
        word += 1;
        return word === highlightedWord ? (
          <mark
            key={index}
            data-nemu-spoken
            className="rounded bg-nemu-amber-100 text-foreground underline decoration-nemu-strong decoration-[3px] underline-offset-4"
          >
            {part}
          </mark>
        ) : (
          <Fragment key={index}>{part}</Fragment>
        );
      })}
    </>
  );
  if (!onRepeat) return <p className="text-2xl leading-8 font-medium">{words}</p>;
  return (
    <button
      type="button"
      onClick={onRepeat}
      title="Klik untuk mendengar lagi"
      className="cursor-pointer text-left text-2xl leading-8 font-medium"
    >
      {words}
    </button>
  );
}

/** A small Nemu link ("Kenapa?", "Sumber", "Lihat ringkasan"): 18 px text in a 44 px target. */
export const NEMU_LINK =
  "h-11 px-0 text-lg font-semibold text-nemu-strong underline underline-offset-4 hover:text-foreground";

const NOTE_ORDER: readonly NemuNoteKind[] = ["kenapa", "sumber", "ringkasan"];

/**
 * Kenapa?, Sumber and Lihat ringkasan as small links. Nothing under them shows or is read until
 * the teacher clicks one; then its text opens below and `onRead` gets it, so Nemu can say it.
 */
export function NemuNoteLinks({
  notes,
  onRead,
}: {
  notes: NemuNotes;
  onRead?: (text: string) => void;
}) {
  const [open, setOpen] = useState<NemuNoteKind | null>(null);
  const kinds = NOTE_ORDER.filter((kind) =>
    kind === "sumber" ? (notes.sumber?.length ?? 0) > 0 : Boolean(notes[kind]),
  );
  if (kinds.length === 0) return null;

  function toggle(kind: NemuNoteKind) {
    if (open === kind) {
      setOpen(null);
      return;
    }
    setOpen(kind);
    onRead?.(noteText(kind, notes));
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-x-6">
        {kinds.map((kind) => (
          <Button
            key={kind}
            type="button"
            variant="link"
            aria-expanded={open === kind}
            onClick={() => toggle(kind)}
            className={NEMU_LINK}
          >
            {NOTE_LABELS[kind]}
          </Button>
        ))}
      </div>
      {open && (
        <div className="rounded-2xl bg-nemu-subtle px-4 py-3 text-xl leading-7 text-nemu-subtle-foreground">
          {open === "sumber" ? (
            <>
              <ul className="flex list-disc flex-col gap-1 pl-5">
                {notes.sumber?.map((source) => (
                  <li key={sourceName(source)}>
                    {typeof source === "string" ? (
                      source
                    ) : (
                      <Button
                        type="button"
                        variant="link"
                        onClick={source.onOpen}
                        className="h-auto min-h-11 p-0 text-left text-xl font-normal whitespace-normal text-nemu-strong underline underline-offset-4 hover:text-foreground"
                      >
                        {source.label}
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
              {notes.sumberLink && (
                <a
                  href={notes.sumberLink.href}
                  target="_blank"
                  rel="noopener"
                  className={cn(NEMU_LINK, "mt-1 inline-flex items-center")}
                >
                  {notes.sumberLink.label}
                </a>
              )}
            </>
          ) : (
            <p>{notes[open]}</p>
          )}
        </div>
      )}
    </div>
  );
}
