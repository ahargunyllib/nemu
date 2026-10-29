import type { NemuAction, NemuGuide } from "@nemu/contracts";
import { Button } from "@nemu/ui/components/button";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

type HighlightStepsProps = {
  steps: readonly NemuAction[];
  guide?: NemuGuide;
  index: number;
  onGoTo: (index: number) => void;
};

/** Which highlight the user is on, with buttons to step back and forth when there are several. */
export function HighlightSteps({ steps, guide, index, onGoTo }: HighlightStepsProps) {
  const step = steps[index];
  const canonicalIndex = guide
    ? Math.min(guide.current_step - 1 + index, guide.steps.length - 1)
    : index;
  const canonicalStep = guide?.steps[canonicalIndex];
  const total = guide?.steps.length ?? steps.length;
  if (total < 2 || !step) return null;

  return (
    <section aria-label="Langkah" className="flex items-center gap-2 bg-muted px-2 py-1.5">
      <p className="min-w-0 flex-1">
        <span className="text-muted-foreground">
          Langkah {canonicalIndex + 1} dari {total}
        </span>{" "}
        <span className="font-medium">{canonicalStep?.label ?? step.label}</span>
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
