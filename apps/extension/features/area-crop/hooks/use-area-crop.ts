import { useCallback, useEffect, useState } from "react";

import type { Box } from "../../../shared/types/box";
import { captureAreaCrop } from "../api/capture-viewport";

export type AreaCropState =
  | { kind: "none" }
  | { kind: "selecting" }
  /** Nemu hides its own overlay while the viewport is captured, so the crop shows only the page. */
  | { kind: "capturing"; selection: Box }
  | { kind: "attached"; crop: string }
  | { kind: "failed" };

/** Waits until the browser has painted the frame with the overlay hidden. */
function nextPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

/**
 * Area select mode: Rina drags a box over the page, and the Area Crop of just that box is
 * attached to her next prompt until she removes it or sends it. `selection` is the attached box,
 * so it can stay outlined on the page.
 */
export function useAreaCrop(capture: (selection: Box) => Promise<string> = captureAreaCrop) {
  const [state, setState] = useState<AreaCropState>({ kind: "none" });
  const [selection, setSelection] = useState<Box>();

  useEffect(() => {
    if (state.kind !== "capturing") return;
    let current = true;
    void nextPaint()
      .then(() => capture(state.selection))
      .then(
        (crop) => {
          if (current) setState({ kind: "attached", crop });
        },
        (error: unknown) => {
          console.warn("[nemu] Area Crop failed", error);
          if (current) setState({ kind: "failed" });
        },
      );
    return () => {
      current = false;
    };
  }, [state, capture]);

  const start = useCallback(() => setState({ kind: "selecting" }), []);
  const select = useCallback((box: Box) => {
    setSelection(box);
    setState({ kind: "capturing", selection: box });
  }, []);
  const clear = useCallback(() => setState({ kind: "none" }), []);

  return {
    state,
    crop: state.kind === "attached" ? state.crop : undefined,
    selection: state.kind === "attached" ? selection : undefined,
    start,
    select,
    clear,
  };
}
