import { type NemuDisplay, spokenText } from "@nemu/ui/lib/nemu-display";
import { NemuStage } from "@nemu/ui/nemu/nemu-stage";
import { useCallback, useMemo, useState } from "react";

import { MICROPHONE_BLOCKED, pointAtAllow } from "../lib/microphone-messages";
import { chromePromptAnchor } from "../lib/permission-prompt";

type MicrophoneDisplayProps = {
  phase: "asking" | "blocked";
  honorific: string;
  onClose: () => void;
  speak: (text: string) => void;
};

/**
 * The microphone's two displays (PRD v2.3). While Chrome asks, the Nemu cursor glides to the
 * right of Chrome's prompt, level with its top Izinkan button, with a Gelembung Tunjuk beside it.
 * The prompt is browser UI Nemu can't see, so an invisible box marks its measured place
 * (`chromePromptAnchor`). A blocked microphone gets a Kartu Info with the three steps.
 */
export function MicrophoneDisplay({ phase, honorific, onClose, speak }: MicrophoneDisplayProps) {
  const [anchor, setAnchor] = useState<HTMLDivElement | null>(null);
  const display = useMemo<NemuDisplay>(
    () =>
      phase === "asking"
        ? { type: "tunjuk", ...pointAtAllow(honorific) }
        : { type: "info", ...MICROPHONE_BLOCKED, items: [...MICROPHONE_BLOCKED.items], onClose },
    [phase, honorific, onClose],
  );
  const onShown = useCallback((shown: NemuDisplay) => speak(spokenText(shown)), [speak]);

  if (phase === "blocked")
    return (
      <div className="pointer-events-auto">
        <NemuStage display={display} onShown={onShown} />
      </div>
    );
  const rect = chromePromptAnchor(window);
  return (
    <>
      <div
        ref={setAnchor}
        aria-hidden
        data-nemu-chrome-prompt
        className="pointer-events-none fixed"
        style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}
      />
      {anchor && <NemuStage display={display} target={anchor} onShown={onShown} />}
    </>
  );
}
