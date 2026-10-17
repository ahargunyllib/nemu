import type { NemuAction } from "@nemu/contracts";
import { Button } from "@nemu/ui/components/button";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

type HighlightStepsProps = {
  steps: readonly NemuAction[];
  index: number;
  onGoTo: (index: number) => void;
};

/** Which highlight the user is on, with buttons to step back and forth when there are several. */
export function HighlightSteps({ steps, index, onGoTo }: HighlightStepsProps) {
  const step = steps[index];
  if (steps.length < 2 || !step) return null;

  return (
    <section aria-label="Langkah" className="flex items-center gap-2 bg-muted px-2 py-1.5">
      <p className="min-w-0 flex-1">
        <span className="text-muted-foreground">
          Langkah {index + 1} dari {steps.length}
        </span>{" "}
        <span className="font-medium">{step.label}</span>
      </p>
      <Button
        aria-label="Langkah sebelumnya"
        size="icon-xs"
        variant="outline"
        disabled={index === 0}
        onClick={() => onGoTo(index - 1)}
      >
        <ChevronLeftIcon />
      </Button>
      <Button
        aria-label="Langkah berikutnya"
        size="icon-xs"
        variant="outline"
        disabled={index === steps.length - 1}
        onClick={() => onGoTo(index + 1)}
      >
        <ChevronRightIcon />
      </Button>
    </section>
  );
}
