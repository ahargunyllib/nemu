import { Button } from "@nemu/ui/components/button";
import { CardContent, CardHeader, CardTitle } from "@nemu/ui/components/card";
import { type KartuPilihProps, orderChoices } from "@nemu/ui/lib/nemu-display";
import { NemuCard } from "@nemu/ui/nemu/nemu-frame";
import { TriangleAlert } from "lucide-react";
import { useId } from "react";

/**
 * Kartu Pilih: a decision. One question and two or three equal, stacked big buttons. Nothing is
 * pre-selected or focused; a risky choice carries ⚠ and sits under the safe one.
 */
export function KartuPilih({ question, choices, onChoose }: KartuPilihProps) {
  const questionId = useId();
  return (
    <NemuCard display="pilih" label="Pilihan Nemu">
      <CardHeader>
        <CardTitle id={questionId} className="text-xl leading-7 font-semibold">
          {question}
        </CardTitle>
      </CardHeader>
      <CardContent role="group" aria-labelledby={questionId} className="flex flex-col gap-3">
        {orderChoices(choices).map((choice) => (
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
    </NemuCard>
  );
}
