import { Badge } from "@nemu/ui/components/badge";
import { NemuBadge } from "@nemu/ui/nemu/nemu-badge";
import { CheckIcon, MousePointer2Icon, TriangleAlertIcon } from "lucide-react";

import type { ClickStep, CursorFrame } from "../lib/navigation-click";

/** Room under the click point for the mascot riding beside the cursor, before the tooltip. */
const TOOLTIP_OFFSET = 52;
/** How close to the viewport's bottom the tooltip moves above the click point instead. */
const TOOLTIP_ROOM = 88;

/**
 * Klik navigasi from the design system, drawn on the page layer: a dot morphs into Nemu's cursor,
 * glides to the target, and an amber ripple plays where it clicks, while a dark pill under the
 * target says what it opens. Then it shows success or a warning. The mascot rides along just below
 * and to the right of it, so the result badge sits past the mascot.
 */
export function NavigationCursor({ frame }: { frame: CursorFrame }) {
  return (
    <div
      aria-hidden
      className="absolute top-0 left-0 ease-in-out motion-reduce:transition-none"
      style={{
        transform: `translate(${frame.at.x}px, ${frame.at.y}px)`,
        transitionProperty: "transform",
        transitionDuration: `${frame.mascot === "clicking" ? frame.moveMs : 0}ms`,
      }}
    >
      {frame.mascot === "clicking" && (
        <>
          <ClickingCursor step={frame.step} />
          {frame.destination && (
            <CursorTooltip
              destination={frame.destination}
              // Esc only stops the click before it lands.
              stoppable={frame.step === "morph" || frame.step === "move"}
              above={frame.at.y + TOOLTIP_ROOM > window.innerHeight}
            />
          )}
        </>
      )}
      {frame.mascot === "success" && (
        <ResultBadge>
          <NemuBadge tone="success">
            <CheckIcon />
            Terbuka
          </NemuBadge>
        </ResultBadge>
      )}
      {frame.mascot === "warning" && (
        <ResultBadge>
          <Badge variant="destructive">
            <TriangleAlertIcon />
            Tidak berhasil
          </Badge>
        </ResultBadge>
      )}
    </div>
  );
}

function ClickingCursor({ step }: { step: ClickStep }) {
  return (
    <div className="relative">
      {step === "morph" && (
        <span className="absolute -top-3 -left-3 size-6 animate-out rounded-full bg-nemu fill-mode-forwards fade-out zoom-out-50 duration-200" />
      )}
      {(step === "click" || step === "check") && (
        <>
          <span className="absolute -top-4 -left-4 size-8 rounded-full border-2 border-nemu-ring" />
          <span className="absolute -top-4 -left-4 size-8 animate-ping rounded-full border-2 border-nemu-ring motion-reduce:hidden" />
        </>
      )}
      {/* The arrow's tip sits about 4 px into the icon, so shift it onto the point. */}
      <MousePointer2Icon className="relative -top-1 -left-1 size-6 animate-in fill-nemu text-nemu-foreground drop-shadow-md fade-in zoom-in-50 duration-200" />
    </div>
  );
}

/**
 * The dark pill under the target, "Membuka Perjalanan Dinas… Esc". Centered on the click point by a
 * zero-width flex row, not translate utilities, whose variables don't reach the shadow root.
 */
function CursorTooltip({
  destination,
  stoppable,
  above,
}: {
  destination: string;
  stoppable: boolean;
  above: boolean;
}) {
  return (
    <div
      className="absolute left-0 flex w-0 justify-center"
      style={above ? { bottom: TOOLTIP_OFFSET } : { top: TOOLTIP_OFFSET }}
    >
      <span className="flex animate-in items-center gap-1.5 rounded-full bg-foreground px-[11px] py-[5px] text-[11.5px]/[15px] font-medium whitespace-nowrap text-background shadow-md fade-in">
        Membuka {destination}…
        {stoppable && (
          <kbd className="rounded-sm bg-background/15 px-1 font-sans text-[10px]/[13px]">Esc</kbd>
        )}
      </span>
    </div>
  );
}

function ResultBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="absolute top-5 left-12 animate-in rounded-4xl bg-background font-sans shadow-md fade-in">
      {children}
    </span>
  );
}
