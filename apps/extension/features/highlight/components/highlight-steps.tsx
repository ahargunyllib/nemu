import type { NemuAction } from "@nemu/contracts";
import { Button } from "@nemu/ui/components/button";
import { cn } from "@nemu/ui/lib/utils";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

type HighlightStepsProps = {
  steps: readonly NemuAction[];
  index: number;
  onGoTo: (index: number) => void;
};

/**
 * The highlighted steps as a numbered list, the current one in nemu-amber, with buttons to step
 * back and forth when there are several.
 */
export function HighlightSteps({ steps, index, onGoTo }: HighlightStepsProps) {
  const step = steps[index];
  if (steps.length < 2 || !step) return null;

  return (
    <section aria-label="Langkah" className="flex flex-col gap-2 rounded-2xl border px-3 py-2.5">
      <div className="flex items-center gap-2">
        <p className="min-w-0 flex-1 text-muted-foreground">
          Langkah {index + 1} dari {steps.length}
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
      </div>
      <ol className="flex flex-col gap-1.5">
        {steps.map((action, position) => {
          const current = position === index;
          return (
            <li
              key={`${position}-${action.target}`}
              aria-current={current ? "step" : undefined}
              className="flex items-center gap-2"
            >
              <span
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-medium",
                  current ? "bg-nemu text-nemu-foreground" : "bg-muted text-muted-foreground",
                )}
              >
                {position + 1}
              </span>
              <span className={current ? "font-medium" : "text-muted-foreground"}>
                {action.label}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
