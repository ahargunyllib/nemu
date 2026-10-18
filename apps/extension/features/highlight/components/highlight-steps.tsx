import type { NemuAction } from "@nemu/contracts";
import { Button } from "@nemu/ui/components/button";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

type HighlightStepsProps = {
  steps: readonly NemuAction[];
  index: number;
  onGoTo: (index: number) => void;
};

/**
 * The highlighted steps as plain numbered text ("1. Pilih ini"), the current one in medium weight,
 * with buttons to step back and forth when there are several.
 */
export function HighlightSteps({ steps, index, onGoTo }: HighlightStepsProps) {
  const step = steps[index];
  if (steps.length < 2 || !step) return null;

  return (
    <section aria-label="Langkah" className="flex flex-col gap-1">
      <div className="flex items-center gap-1">
        <p className="min-w-0 flex-1 text-muted-foreground">
          Langkah {index + 1} dari {steps.length}
        </p>
        <Button
          aria-label="Langkah sebelumnya"
          size="icon-xs"
          variant="ghost"
          disabled={index === 0}
          onClick={() => onGoTo(index - 1)}
        >
          <ChevronLeftIcon />
        </Button>
        <Button
          aria-label="Langkah berikutnya"
          size="icon-xs"
          variant="ghost"
          disabled={index === steps.length - 1}
          onClick={() => onGoTo(index + 1)}
        >
          <ChevronRightIcon />
        </Button>
      </div>
      <ol className="flex flex-col">
        {steps.map((action, position) => {
          const current = position === index;
          return (
            <li
              key={`${position}-${action.target}`}
              aria-current={current ? "step" : undefined}
              className={current ? "font-medium" : "text-muted-foreground"}
            >
              {position + 1}. {action.label}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
