import { Button } from "@nemu/ui/components/button";
import {
  NEMU_BUTTON,
  NEMU_OUTLINE,
  NemuActionRow,
  NemuBubble,
  NemuText,
} from "@nemu/ui/nemu/nemu-frame";
import { cn } from "@nemu/ui/lib/utils";

import type { RecordingDisplay } from "../stores/recorder";

/**
 * While Nemu records "Rekam cara": a Gelembung with the MEREKAM heading and the operator's name,
 * the latest explanation in quotes, and on the right [Jeda] (or [Lanjut] while paused) and
 * [Selesai]. No ×: a recording ends with Selesai.
 */
export function RecordingBubble({ recording }: { recording: RecordingDisplay }) {
  const { status, sentence, detail, paused, onPause, onResume, onFinish } = recording;
  return (
    <NemuBubble display="kerja" label="Nemu merekam" status={status} aria-live="polite">
      <NemuText sentence={sentence} detail={detail} />
      <NemuActionRow>
        <Button
          type="button"
          variant="outline"
          aria-pressed={paused}
          onClick={paused ? onResume : onPause}
          className={cn(NEMU_BUTTON, NEMU_OUTLINE)}
        >
          {paused ? "Lanjut" : "Jeda"}
        </Button>
        <Button type="button" onClick={onFinish} className={NEMU_BUTTON}>
          Selesai
        </Button>
      </NemuActionRow>
    </NemuBubble>
  );
}
