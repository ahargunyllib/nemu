import { Button } from "@nemu/ui/components/button";
import { Card } from "@nemu/ui/components/card";
import { Progress } from "@nemu/ui/components/progress";
import {
  NOTE_LABELS,
  type NemuNoteKind,
  type NemuNotes,
  type NemuStatus,
  type NemuTone,
  noteText,
  sourceName,
  statusCount,
  statusText,
  statusTone,
} from "@nemu/ui/lib/nemu-display";
import { NemuMascot, type NemuMascotMood } from "@nemu/ui/nemu/nemu-mascot";
import { cn } from "cn";
import { type ComponentProps, Fragment, type ReactNode, useState } from "react";

/*
 * The building blocks the five display types share (PRD §6.2): a plain white surface, the
 * heading, the text and the action row. Sizes: bubble text 24 px, card text 20 px, every button
 * at least 44 px. Contrast: text is `foreground` on white, or
 * `nemu-strong` (amber 800) on white or `nemu-subtle`, all at least 7:1.
 */

/**
 * A compact button in a display's action row: a 52 px pill with 18 px semibold text. The main
 * action is the stock default Button (black); a second one is the stock outline with this plus
 * `NEMU_OUTLINE`.
 */
export const NEMU_BUTTON =
  "h-13 min-h-11 gap-2 rounded-full px-5 text-lg leading-6 font-semibold [&_svg:not([class*='size-'])]:size-5";

/** The outline button's 2 px edge on white, so it reads as a button beside the black one. */
export const NEMU_OUTLINE = "border-2 bg-background";

type NemuBubbleProps = ComponentProps<typeof Card> & {
  /** Which of the five it is, for the page's own scripts and tests. */
  display: "kerja" | "tunjuk" | "jawab";
  label: string;
  status?: NemuStatus;
};

/** The plain white surface every display shares: the stock card, rounded, with the Float shadow. */
const SURFACE =
  "max-w-[calc(100vw-16px)] gap-4 rounded-3xl py-5 text-foreground shadow-nemu-float [--card-spacing:--spacing(6)]";

/** A Gelembung: a plain white bubble with the Float shadow. */
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
      className={cn(SURFACE, "relative w-[420px] text-2xl", className)}
      {...props}
    >
      {status && <NemuHeading status={status} className="px-(--card-spacing)" />}
      <div className="flex flex-col gap-4 px-(--card-spacing)">{children}</div>
    </Card>
  );
}

type NemuCardProps = ComponentProps<typeof Card> & {
  display: "pilih" | "info";
  label: string;
  status?: NemuStatus;
};

/** A Kartu: the same plain white surface, for deciding or reading. */
export function NemuCard({ display, label, status, className, children, ...props }: NemuCardProps) {
  return (
    <Card
      role="region"
      aria-label={label}
      data-nemu-display={display}
      className={cn(SURFACE, "w-[400px] text-xl", className)}
      {...props}
    >
      {status && <NemuHeading status={status} className="px-(--card-spacing)" />}
      {children}
    </Card>
  );
}

const TONE_TEXT: Record<NemuTone, string> = {
  nemu: "text-nemu-strong",
  muted: "text-nemu-secondary",
  danger: "text-nemu-danger-strong",
  warning: "text-nemu-danger-strong",
  success: "text-nemu-success-strong",
};

const TONE_MOOD: Record<NemuTone, NemuMascotMood> = {
  nemu: "idle",
  muted: "idle",
  danger: "idle",
  warning: "warning",
  success: "success",
};

/**
 * The heading on top of every display (Kepala): a 28 px mascot, the label in 14 px bold
 * capitals coloured by its tone, a count on the right ("3 dari 32", "10.02") and, with progress,
 * a thin bar under it. It is never read aloud; the words carry the state, not the colour.
 */
export function NemuHeading({ status, className }: { status: NemuStatus; className?: string }) {
  const tone = statusTone(status);
  const count = statusCount(status);
  const progress = status.progress;
  return (
    <div data-nemu-status={tone} className={cn("flex flex-col gap-3", className)}>
      <div className="flex min-h-7 items-center gap-2.5">
        <NemuMascot mood={TONE_MOOD[tone]} className="size-7 shrink-0" />
        <p
          className={cn(
            "min-w-0 flex-1 text-sm leading-[18px] font-bold tracking-[0.06em] uppercase",
            TONE_TEXT[tone],
          )}
        >
          {status.text}
        </p>
        {count && (
          <p className="shrink-0 text-base leading-5 font-semibold text-nemu-secondary tabular-nums">
            {count}
          </p>
        )}
      </div>
      {progress && (
        <Progress
          value={progress.total > 0 ? (progress.done / progress.total) * 100 : 0}
          aria-label={statusText(status)}
          className="[&_[data-slot=progress-indicator]]:bg-nemu [&_[data-slot=progress-track]]:h-2 [&_[data-slot=progress-track]]:bg-nemu-amber-100"
        />
      )}
    </div>
  );
}

const SENTENCE = "text-2xl leading-8 font-semibold tracking-[-0.01em]";

/**
 * Nemu's one sentence at 24 px semibold. While Nemu's voice reads it (#200), the word it is on is marked
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
  if (!onRepeat) return <p className={SENTENCE}>{words}</p>;
  return (
    <button
      type="button"
      onClick={onRepeat}
      title="Klik untuk mendengar lagi"
      className={cn(SENTENCE, "cursor-pointer text-left")}
    >
      {words}
    </button>
  );
}

/** The quieter line under a sentence, question or title: 18 px `nemu-secondary`. Never read aloud. */
export const NEMU_DETAIL = "text-lg leading-[26px] font-normal text-nemu-secondary";

/** A bubble's text: the sentence, and under it the optional detail line. */
export function NemuText({
  detail,
  ...sentence
}: ComponentProps<typeof NemuSentence> & { detail?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <NemuSentence {...sentence} />
      {detail && (
        <p data-nemu-detail className={NEMU_DETAIL}>
          {detail}
        </p>
      )}
    </div>
  );
}

/** A small Nemu link ("Kenapa?", "Sumber", "Lihat ringkasan"): 18 px text in a 44 px target. */
export const NEMU_LINK =
  "h-11 px-0 text-lg font-semibold text-nemu-strong underline underline-offset-4 hover:text-foreground";

const NOTE_ORDER: readonly NemuNoteKind[] = ["kenapa", "sumber", "ringkasan"];

/**
 * The last row of a display: its small links on the left and its compact buttons on the right,
 * the main (black) one last. It wraps when the card is too narrow for both.
 */
export function NemuActionRow({
  links,
  children,
  className,
}: {
  links?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      data-nemu-actions
      className={cn("flex w-full flex-wrap items-center gap-x-6 gap-y-2", className)}
    >
      {links && <div className="flex flex-wrap gap-x-6">{links}</div>}
      {children && <div className="ml-auto flex items-center gap-2.5">{children}</div>}
    </div>
  );
}

/**
 * Kenapa?, Sumber and Lihat ringkasan as small links, with the display's `actions` on the right
 * of the same row. Nothing under the links shows or is read until the teacher clicks one; then
 * its text opens below the row and `onRead` gets it, so Nemu can say it.
 */
export function NemuNoteLinks({
  notes,
  onRead,
  actions,
}: {
  notes: NemuNotes;
  onRead?: (text: string) => void;
  /** The compact buttons on the right of the links' row. */
  actions?: ReactNode;
}) {
  const [open, setOpen] = useState<NemuNoteKind | null>(null);
  const kinds = NOTE_ORDER.filter((kind) =>
    kind === "sumber" ? (notes.sumber?.length ?? 0) > 0 : Boolean(notes[kind]),
  );
  if (kinds.length === 0 && !actions) return null;

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
      <NemuActionRow
        links={
          kinds.length > 0 &&
          kinds.map((kind) => (
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
          ))
        }
      >
        {actions}
      </NemuActionRow>
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
