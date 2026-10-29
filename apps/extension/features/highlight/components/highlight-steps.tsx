import type { NemuAction, NemuGuide } from "@nemu/contracts";
import { Button } from "@nemu/ui/components/button";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

type HighlightStepsProps = {
  steps: readonly NemuAction[];
  guide?: NemuGuide;
  index: number;
  onGoTo: (index: number) => void;
};

/**
 * The highlighted steps as plain numbered text ("1. Pilih ini"), the current one in medium weight,
 * with buttons to step back and forth when there are several. A server guide numbers the steps
 * across pages, so its steps are listed instead of only this page's.
 */
export function HighlightSteps({ steps, guide, index, onGoTo }: HighlightStepsProps) {
  const step = steps[index];
  const canonicalIndex = guide
    ? Math.min(guide.current_step - 1 + index, guide.steps.length - 1)
    : index;
  const total = guide?.steps.length ?? steps.length;
  if (total < 2 || !step) return null;

  return (
    <section aria-label="Langkah" className="flex flex-col gap-1">
      <div className="flex items-center gap-1">
        <p className="min-w-0 flex-1 text-muted-foreground">
          Langkah {canonicalIndex + 1} dari {total}
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
        {(guide?.steps ?? steps).map((item, position) => {
          const current = position === canonicalIndex;
          return (
            <li
              key={`${position}-${item.target}`}
              aria-current={current ? "step" : undefined}
              className={current ? "font-medium" : "text-muted-foreground"}
            >
              {position + 1}. {item.label}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
