import { Badge } from "@nemu/ui/components/badge";
import { CheckIcon, MousePointer2Icon, TriangleAlertIcon } from "lucide-react";

import type { ClickStep, CursorFrame } from "../lib/navigation-click";

/**
 * The mascot's stand-in during a navigation click, drawn on the page layer: a dot that morphs
 * into a cursor, glides to the target, pings on the click, then shows success or a warning.
 * The mascot (#6) replaces it and reads the same frames.
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
      {frame.mascot === "clicking" && <ClickingCursor step={frame.step} />}
      {frame.mascot === "success" && (
        <ResultBadge variant="default">
          <CheckIcon />
          Terbuka
        </ResultBadge>
      )}
      {frame.mascot === "warning" && (
        <ResultBadge variant="destructive">
          <TriangleAlertIcon />
          Tidak berhasil
        </ResultBadge>
      )}
    </div>
  );
}

function ClickingCursor({ step }: { step: ClickStep }) {
  return (
    <div className="relative">
      {step === "morph" && (
        <span className="absolute -top-3 -left-3 size-6 animate-out rounded-full bg-primary fill-mode-forwards fade-out zoom-out-50 duration-200" />
      )}
      {(step === "click" || step === "check") && (
        <span className="absolute -top-3 -left-3 size-6 animate-ping rounded-full bg-primary/40" />
      )}
      {/* The arrow's tip sits about 4 px into the icon, so shift it onto the point. */}
      <MousePointer2Icon className="relative -top-1 -left-1 size-6 animate-in fill-primary text-primary-foreground drop-shadow-md fade-in zoom-in-50 duration-200" />
    </div>
  );
}

function ResultBadge({
  variant,
  children,
}: {
  variant: "default" | "destructive";
  children: React.ReactNode;
}) {
  return (
    <span className="absolute top-3 left-3 animate-in rounded-4xl bg-background font-sans shadow-md fade-in">
      <Badge variant={variant}>{children}</Badge>
    </span>
  );
}
