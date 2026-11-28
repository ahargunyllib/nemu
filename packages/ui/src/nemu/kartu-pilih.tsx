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
import { cn } from "cn";
import { TriangleAlert } from "lucide-react";
import { useId } from "react";

/**
 * Kartu Pilih: a decision. One question, an optional detail line ("Pilih salah satu, Nemu
 * menunggu."), and two or three equal, stacked big buttons. Nothing is
 * pre-selected or focused; a risky choice carries ⚠ and sits under the safe one. An `image`
 * shows what the question is about in a framed box with an optional caption (W5's photo crop,
 * the WhatsApp photo), and one `link` can sit at the bottom left ("Lihat foto utuh"). `compact`
 * is the card that waits beside the Nemu button: its choices are
 * compact buttons on the right, in the order given, the `primary` one black ("Foto masuk ·
 * Nanti / Mulai").
 */
export function KartuPilih({
  question,
  detail,
  choices,
  onChoose,
  image,
  note,
  link,
  compact = false,
  status,
}: KartuPilihProps) {
  const questionId = useId();
  const ordered = orderChoices(choices);
  return (
    <NemuCard display="pilih" label="Pilihan Nemu" status={status}>
      <CardHeader className="gap-1.5">
        <CardTitle id={questionId} className="text-xl leading-7 font-semibold">
          {question}
        </CardTitle>
        {detail && (
          <CardDescription data-nemu-detail className={NEMU_DETAIL}>
            {detail}
          </CardDescription>
        )}
      </CardHeader>
      {image && (image.src || compact) && (
        <CardContent>
          <figure className="flex flex-col gap-2 rounded-2xl border border-nemu-amber-100 bg-nemu-subtle p-3">
            {image.caption && (
              <figcaption className="text-sm leading-[18px] text-nemu-secondary">
                {image.caption}
              </figcaption>
            )}
            {image.src ? (
              <img
                src={image.src}
                alt={image.alt}
                className={cn(
                  "w-full rounded-xl",
                  compact ? "h-32 object-cover object-top" : "max-h-[50vh] object-contain",
                )}
              />
            ) : (
              <Skeleton aria-hidden className="h-32 w-full rounded-xl" />
            )}
          </figure>
        </CardContent>
      )}
      {compact ? (
        <CardFooter>
          <NemuActionRow>
            <div role="group" aria-labelledby={questionId} className="flex items-center gap-2.5">
              {ordered.map((choice) => (
                <Button
                  key={choice.id}
                  type="button"
                  variant={choice.primary ? "default" : "outline"}
                  data-primary={choice.primary ? "" : undefined}
                  data-risky={choice.risky ? "" : undefined}
                  onClick={() => onChoose(choice.id)}
                  className={cn(NEMU_BUTTON, !choice.primary && NEMU_OUTLINE)}
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
            </div>
          </NemuActionRow>
        </CardFooter>
      ) : (
        <CardContent role="group" aria-labelledby={questionId} className="flex flex-col gap-3">
          {ordered.map((choice) => (
            <Button
              key={choice.id}
              type="button"
              variant="outline"
              data-risky={choice.risky ? "" : undefined}
              onClick={() => onChoose(choice.id)}
              className="h-auto min-h-14 w-full justify-start gap-3 rounded-2xl border-2 px-5 py-3 text-left text-xl leading-7 font-semibold whitespace-normal [&_svg:not([class*='size-'])]:size-6"
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
      {link && (
        <CardFooter>
          <NemuActionRow
            links={
              <Button type="button" variant="link" onClick={link.onSelect} className={NEMU_LINK}>
                {link.label}
              </Button>
            }
          />
        </CardFooter>
      )}
    </NemuCard>
  );
}
