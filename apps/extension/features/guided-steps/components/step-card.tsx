import type { NemuAction } from "@nemu/contracts";
import { Button } from "@nemu/ui/components/button";
import { Card, CardContent } from "@nemu/ui/components/card";
import { XIcon } from "lucide-react";
import type { Ref } from "react";

import type { Box } from "../../../shared/types/box";
import { CARD_BODY } from "../../answer-card/lib/typography";
import { noteSegments } from "../lib/guided-steps";
import { ValueStrip } from "./value-strip";

type StepCardProps = {
  action: NemuAction;
  /** Where the card sits, from `placeStepCard`. */
  place: Box;
  /** Measures the card, so it can be placed above a target near the viewport's bottom. */
  ref?: Ref<HTMLDivElement>;
  onClose: () => void;
};

/**
 * The step card of a guided step (docs/design-system.md, "Guided steps"): a small header-less
 * white card beside the target, with the step's note, `**bold**` for what to pick, and the value
 * to enter with a Salin button when the step has one. The mascot perches on its top-left corner;
 * × ends the guide.
 */
export function StepCard({ action, place, ref, onClose }: StepCardProps) {
  return (
    <Card
      ref={ref}
      size="sm"
      role="dialog"
      aria-label="Langkah Nemu"
      data-nemu-step-card={action.target}
      className={`pointer-events-auto absolute animate-in shadow-lg fade-in motion-reduce:animate-none ${CARD_BODY}`}
      style={{ left: place.left, top: place.top, width: place.width }}
    >
      <Button
        aria-label="Akhiri panduan"
        size="icon-xs"
        variant="ghost"
        className="absolute top-2 right-2"
        onClick={onClose}
      >
        <XIcon />
      </Button>
      <CardContent className="flex flex-col gap-3">
        {action.note && (
          <p className="pr-5">
            {noteSegments(action.note).map((segment, index) =>
              segment.bold ? (
                // A note's runs never reorder, so their positions are stable keys.
                <strong key={index} className="font-semibold">
                  {segment.text}
                </strong>
              ) : (
                segment.text
              ),
            )}
          </p>
        )}
        {action.value && <ValueStrip value={action.value} />}
      </CardContent>
    </Card>
  );
}
