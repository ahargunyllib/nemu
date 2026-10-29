import { useEffect } from "react";

/** Calls `onCancel` when Rina presses Esc while `active`, such as while Membaca shows. */
export function useCancelOnEscape(active: boolean, onCancel: () => void) {
  useEffect(() => {
    if (!active) return;

    function cancelOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onCancel();
    }
    // Capture, so Esc works wherever focus is, including inside the overlay's shadow root.
    window.addEventListener("keydown", cancelOnEscape, { capture: true });
    return () => window.removeEventListener("keydown", cancelOnEscape, { capture: true });
  }, [active, onCancel]);
}
