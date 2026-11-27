import { Button } from "@nemu/ui/components/button";
import { CardContent, CardFooter, CardHeader, CardTitle } from "@nemu/ui/components/card";
import { type KartuPilihProps, orderChoices } from "@nemu/ui/lib/nemu-display";
import { NemuCard } from "@nemu/ui/nemu/nemu-frame";
import { cn } from "cn";
import { TriangleAlert } from "lucide-react";
import { useId } from "react";

/**
 * Kartu Pilih: a decision. One question and two or three equal, stacked big buttons. Nothing is
 * pre-selected or focused; a risky choice carries ⚠ and sits under the safe one. An `image`
 * shows what the question is about (W5's photo crop); `compact` is the small card that waits
 * beside the Nemu button, with 44 px buttons.
 */
export function KartuPilih({
  question,
  choices,
  onChoose,
  image,
  note,
  compact = false,
}: KartuPilihProps) {
  const questionId = useId();
  return (
    <NemuCard display="pilih" label="Pilihan Nemu" className={cn(compact && "w-[300px] gap-3")}>
      <CardHeader>
        <CardTitle
          id={questionId}
          className={cn("font-semibold", compact ? "text-lg leading-6" : "text-xl leading-7")}
        >
          {question}
        </CardTitle>
      </CardHeader>
      {image && (
        <CardContent>
          <img
            src={image.src}
            alt={image.alt}
            className="max-h-44 w-full rounded-2xl border-2 border-border bg-muted object-contain"
          />
        </CardContent>
      )}
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
      {note && (
        <CardFooter className="text-lg leading-6 text-muted-foreground">
          <p>{note}</p>
        </CardFooter>
      )}
    </NemuCard>
  );
}
