import { Button } from "@nemu/ui/components/button";
import type { GelembungKerjaProps } from "@nemu/ui/lib/nemu-display";
import { BIG_BUTTON, NemuBubble, NemuText } from "@nemu/ui/nemu/nemu-frame";
import { Square, Turtle } from "lucide-react";

/**
 * Gelembung Kerja: Nemu is working. The status header with its progress bar, one sentence with an
 * optional detail line, and always [Pelan] [Berhenti].
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
      <div className="grid grid-cols-2 gap-3">
        <Button
          type="button"
          variant="outline"
          aria-pressed={slow ?? false}
          onClick={onSlow}
          className={`${BIG_BUTTON} aria-pressed:border-nemu-strong aria-pressed:bg-nemu-subtle`}
        >
          <Turtle aria-hidden />
          Pelan
        </Button>
        <Button type="button" variant="outline" onClick={onStop} className={BIG_BUTTON}>
          <Square aria-hidden />
          Berhenti
        </Button>
      </div>
    </NemuBubble>
  );
}
