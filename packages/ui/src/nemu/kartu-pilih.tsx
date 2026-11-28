import { Button } from "@nemu/ui/components/button";
import {
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@nemu/ui/components/card";
import { Skeleton } from "@nemu/ui/components/skeleton";
import { type KartuPilihProps, orderChoices } from "@nemu/ui/lib/nemu-display";
import {
  NEMU_BUTTON,
  NEMU_DETAIL,
  NEMU_LINK,
  NEMU_OUTLINE,
  NemuActionRow,
  NemuCard,
} from "@nemu/ui/nemu/nemu-frame";
import { NemuSteps } from "@nemu/ui/nemu/nemu-steps";
import { cn } from "cn";
import { TriangleAlert } from "lucide-react";
import { useId } from "react";

/**
 * Kartu Pilih: a decision. One question, an optional detail line ("Pilih salah satu, Nemu
 * menunggu."), and two or three equal, stacked big buttons. Nothing is
 * pre-selected or focused; a risky choice carries ⚠ and sits under the safe one. An `image`
 * shows what the question is about (W5's photo crop); `compact` is the small card that waits
 * beside the Nemu button, with 44 px buttons, and its `image` is a thumbnail beside the question
 * ("Foto dari WhatsApp", #278). A start card (`layout: "row"`) shows the `file` it is about as a
 * chip, lists the `steps` Nemu is about to take and puts its choices in the action row, a `link`
 * on the left: [Nanti] [Mulai].
 */
export function KartuPilih({
  question,
  detail,
  choices,
  onChoose,
  image,
  note,
  compact = false,
  status,
  file,
  steps,
  link,
  layout = "stack",
}: KartuPilihProps) {
  const questionId = useId();
  return (
    <NemuCard
      display="pilih"
      label="Pilihan Nemu"
      status={status}
      className={cn(compact && "w-[300px] gap-3 [--card-spacing:--spacing(5)]")}
    >
      <CardHeader className={cn(compact && image && "flex items-center gap-3")}>
        {compact &&
          image &&
          (image.src ? (
            <img
              src={image.src}
              alt={image.alt}
              className="size-16 shrink-0 rounded-xl border-2 border-border bg-muted object-cover object-top"
            />
          ) : (
            <Skeleton aria-hidden className="size-16 shrink-0" />
          ))}
        <div className="flex flex-col gap-1.5">
          <CardTitle
            id={questionId}
            className={cn("font-semibold", compact ? "text-lg leading-6" : "text-xl leading-7")}
          >
            {question}
          </CardTitle>
          {detail && (
            <CardDescription data-nemu-detail className={NEMU_DETAIL}>
              {detail}
            </CardDescription>
          )}
        </div>
      </CardHeader>
      {!compact && image?.src && (
        <CardContent>
          <img
            src={image.src}
            alt={image.alt}
            className="max-h-44 w-full rounded-2xl border-2 border-border bg-muted object-contain"
          />
        </CardContent>
      )}
      {file && (
        <CardContent>
          <div
            data-nemu-file
            className="flex items-center gap-3 rounded-2xl border border-border bg-muted px-4 py-3"
          >
            <span
              aria-hidden
              className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-xs font-semibold text-destructive"
            >
              {file.kind}
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-base leading-5 font-semibold">{file.name}</span>
              {file.meta && (
                <span className="text-sm leading-5 text-nemu-secondary">{file.meta}</span>
              )}
            </span>
          </div>
        </CardContent>
      )}
      {steps && steps.length > 0 && (
        <CardContent>
          <NemuSteps items={steps} />
        </CardContent>
      )}
      {layout === "row" ? (
        <CardFooter>
          <NemuActionRow
            links={
              link && (
                <Button type="button" variant="link" onClick={link.onSelect} className={NEMU_LINK}>
                  {link.label}
                </Button>
              )
            }
          >
            <div role="group" aria-labelledby={questionId} className="flex items-center gap-2.5">
              {choices.map((choice, index) => (
                <Button
                  key={choice.id}
                  type="button"
                  variant={index === choices.length - 1 ? "default" : "outline"}
                  onClick={() => onChoose(choice.id)}
                  className={cn(NEMU_BUTTON, index < choices.length - 1 && NEMU_OUTLINE)}
                >
                  {choice.label}
                </Button>
              ))}
            </div>
          </NemuActionRow>
        </CardFooter>
      ) : (
        <CardContent
          role="group"
          aria-labelledby={questionId}
          className={cn("flex", compact ? "gap-2" : "flex-col gap-3")}
        >
          {orderChoices(choices).map((choice) => (
            <Button
              key={choice.id}
              type="button"
              variant="outline"
              data-risky={choice.risky ? "" : undefined}
              onClick={() => onChoose(choice.id)}
              className={cn(
                "h-auto w-full justify-start gap-3 rounded-2xl border-2 text-left font-semibold whitespace-normal [&_svg:not([class*='size-'])]:size-6",
                compact
                  ? "min-h-11 flex-1 justify-center px-4 py-2 text-lg leading-6"
                  : "min-h-14 px-5 py-3 text-xl leading-7",
              )}
            >
              {choice.risky && (
                <>
                  <TriangleAlert aria-hidden className="text-destructive" />
                  <span className="sr-only">Berisiko: </span>
                </>
              )}
              {choice.label}
            </Button>
          ))}
        </CardContent>
      )}
      {note && (
        <CardFooter className="text-lg leading-6 text-muted-foreground">
          <p>{note}</p>
        </CardFooter>
      )}
    </NemuCard>
  );
}
