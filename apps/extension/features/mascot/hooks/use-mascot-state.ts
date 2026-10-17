import { useEffect, useState } from "react";

import { RESTING_MS } from "../../navigation-click/hooks/use-navigation-click";
import {
  isResult,
  type MascotActivity,
  type MascotState,
  mascotStateFor,
} from "../lib/mascot-state";

/**
 * The mascot's state for what Nemu is doing. Success and warning rest after 3 seconds; Esc returns
 * the mascot to idle until Rina opens the Composer again.
 */
export function useMascotState(activity: MascotActivity): MascotState {
  const live = mascotStateFor(activity);
  const [result, setResult] = useState({ live, rested: false });
  const [dismissed, setDismissed] = useState(false);
  const [wasListening, setWasListening] = useState(activity.listening);

  // A new state starts its own rest; opening the Composer again wakes a dismissed mascot.
  if (result.live !== live) setResult({ live, rested: false });
  if (wasListening !== activity.listening) {
    setWasListening(activity.listening);
    if (activity.listening) setDismissed(false);
  }

  useEffect(() => {
    if (!isResult(live)) return;
    const timer = setTimeout(
      () => setResult((current) => (current.live === live ? { live, rested: true } : current)),
      RESTING_MS,
    );
    return () => clearTimeout(timer);
  }, [live]);

  useEffect(() => {
    function dismissOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setDismissed(true);
    }
    // Capture, so Esc works wherever focus is, including inside the overlay's shadow root.
    window.addEventListener("keydown", dismissOnEscape, { capture: true });
    return () => window.removeEventListener("keydown", dismissOnEscape, { capture: true });
  }, []);

  if (activity.listening) return "listening";
  if (dismissed) return "idle";
  return mascotStateFor(activity, result.live === live && result.rested);
}
