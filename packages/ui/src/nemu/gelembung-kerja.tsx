import { Button } from "@nemu/ui/components/button";
import type { GelembungKerjaProps } from "@nemu/ui/lib/nemu-display";
import {
  NEMU_BUTTON,
  NEMU_OUTLINE,
  NemuActionRow,
  NemuBubble,
  NemuText,
} from "@nemu/ui/nemu/nemu-frame";
import { cn } from "cn";

/**
 * Gelembung Kerja: Nemu is working. The heading with its progress bar, one sentence with an
 * optional detail line, and on the right [Pelan] (when Nemu can slow down) and [Berhenti].
 */
export function GelembungKerja({
  sentence,
  detail,
  highlightedWord,
  status,
  slow,
  onSlow,
  onStop,
}: GelembungKerjaProps) {
  return (
    <NemuBubble display="kerja" label="Nemu bekerja" status={status}>
      <NemuText sentence={sentence} detail={detail} highlightedWord={highlightedWord} />
      <NemuActionRow>
        {onSlow && (
          <Button
            type="button"
            variant="outline"
            aria-pressed={slow ?? false}
            onClick={onSlow}
            className={cn(
              NEMU_BUTTON,
              NEMU_OUTLINE,
              "aria-pressed:border-nemu-strong aria-pressed:bg-nemu-subtle",
            )}
          >
            Pelan
          </Button>
        )}
        <Button type="button" onClick={onStop} className={NEMU_BUTTON}>
          Berhenti
        </Button>
      </NemuActionRow>
    </NemuBubble>
  );
}
