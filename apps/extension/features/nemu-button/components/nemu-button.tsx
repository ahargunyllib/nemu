import { Button } from "@nemu/ui/components/button";
import { Kbd, KbdGroup } from "@nemu/ui/components/kbd";
import { NemuMascot } from "@nemu/ui/nemu/nemu-mascot";
import { Fragment, useRef } from "react";

/** A press on the Nemu button longer than this talks instead of opening the type box. */
const HOLD_DELAY_MS = 350;

type NemuButtonProps = {
  open: boolean;
  /** The talk combination's keys for the hint, e.g. ["Ctrl", "Spasi"]. */
  shortcutKeys: readonly string[];
  onToggle: () => void;
  onHoldStart: () => void;
  onHoldEnd: () => void;
};

/**
 * The Nemu button at the bottom right of every allowed page: the dark orange `nemu` disc with the
 * mascot. A click opens the type box; pressing and holding it talks, like the combination.
 */
export function NemuButton({
  open,
  shortcutKeys,
  onToggle,
  onHoldStart,
  onHoldEnd,
}: NemuButtonProps) {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const held = useRef(false);

  function endHold() {
    clearTimeout(timer.current);
    if (held.current) onHoldEnd();
  }

  return (
    <div className="flex items-center gap-2">
      {!open && (
        <p className="rounded-full bg-background px-3 py-1.5 text-xs text-muted-foreground shadow-nemu-float">
          Tahan{" "}
          <KbdGroup>
            {shortcutKeys.map((key, index) => (
              <Fragment key={key}>
                {index > 0 && "+"}
                <Kbd>{key}</Kbd>
              </Fragment>
            ))}
          </KbdGroup>{" "}
          untuk bicara
        </p>
      )}
      <Button
        type="button"
        size="icon-lg"
        aria-label={open ? "Tutup Nemu" : "Tanya Nemu"}
        aria-expanded={open}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          held.current = false;
          timer.current = setTimeout(() => {
            held.current = true;
            onHoldStart();
          }, HOLD_DELAY_MS);
        }}
        onPointerUp={endHold}
        onPointerCancel={endHold}
        onClick={() => {
          if (held.current) held.current = false;
          else onToggle();
        }}
        className="size-14 rounded-full bg-nemu p-1 text-nemu-foreground shadow-nemu-float hover:bg-nemu-amber-700"
      >
        <span aria-hidden className="flex size-12 rounded-full bg-nemu-foreground">
          <NemuMascot />
        </span>
      </Button>
    </div>
  );
}
