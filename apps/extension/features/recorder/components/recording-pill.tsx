import { Badge } from "@nemu/ui/components/badge";
import { cn } from "@nemu/ui/lib/utils";

/**
 * The small pill at the top of the page while Nemu records, so the operator sees it even with
 * the bubble out of mind: "● Merekam cara · langkah 6" on `nemu-danger-strong`, or "Dijeda ·
 * langkah 6" on grey during Jeda. Click-through, so it never covers a control.
 */
export function RecordingPill({ paused, steps }: { paused: boolean; steps: number }) {
  const what = paused ? "Dijeda" : "Merekam cara";
  return (
    <div className="pointer-events-none fixed top-4 left-1/2 z-[2147483647] -translate-x-1/2 font-sans">
      <Badge
        role="status"
        data-nemu-recording={paused ? "paused" : "recording"}
        className={cn(
          // The colour changes at once with the words, not through the Badge's fade.
          "h-8 gap-2 px-3.5 text-sm font-semibold text-white shadow-nemu-float transition-none",
          paused ? "bg-nemu-secondary" : "bg-nemu-danger-strong",
        )}
      >
        <span
          aria-hidden
          className={cn("size-2 rounded-full bg-white", !paused && "animate-pulse")}
        />
        {steps > 0 ? `${what} · langkah ${steps}` : what}
      </Badge>
    </div>
  );
}
