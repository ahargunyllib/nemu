import type { NemuGuide } from "@nemu/contracts";

import type { HighlightStep } from "../lib/highlight-targets";

type StepProgressProps = {
  steps: readonly HighlightStep[];
  guide?: NemuGuide;
  index: number;
};

/**
 * The Answer Card's kicker for a guided answer: "Langkah 2 dari 6" in Nemu amber. A server guide
 * numbers the steps across pages, so the current step counts its place among all the guide's
 * steps, even when an earlier target is missing from the page.
 */
export function StepProgress({ steps, guide, index }: StepProgressProps) {
  const step = steps[index];
  const total = guide?.steps.length ?? steps.length;
  if (total < 2 || !step) return null;
  const canonicalIndex = guide
    ? Math.min(guide.current_step - 1 + step.position, guide.steps.length - 1)
    : index;

  return (
    <p className="text-xs/4 font-semibold text-nemu-text">
      Langkah {canonicalIndex + 1} dari {total}
    </p>
  );
}
