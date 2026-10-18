import { cn } from "@nemu/ui/lib/utils";

import { PROCESS_TONES, type ProcessTone } from "@/features/processes/lib/processes";

/** A process's initials in its colour, e.g. the orange "PD" of Perjalanan Dinas. */
export default function ProcessBadge({
  code,
  tone,
  className,
}: {
  code: string;
  tone: ProcessTone;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-xl text-sm font-semibold",
        PROCESS_TONES[tone],
        className,
      )}
    >
      {code}
    </span>
  );
}
