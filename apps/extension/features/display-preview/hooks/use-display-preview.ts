import type { NemuDisplay } from "@nemu/ui/lib/nemu-display";
import { useCallback, useMemo, useState } from "react";

import { type PreviewScene, sceneDisplay, sceneTargetSelector } from "../lib/preview-scenes";

type Staged = { scene: PreviewScene; step: number; target: Element | null };

/** Waits for the mock AlurSekolah to draw a page after its hash changes. */
function nextPage(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 100));
}

/**
 * The preview's one display slot. Scenes with a target open the mock's Isi nilai page first;
 * pressing Gerak kursor again moves the cursor to the other target.
 */
export function useDisplayPreview() {
  const [staged, setStaged] = useState<Staged | null>(null);
  const [slow, setSlow] = useState(false);
  const close = useCallback(() => setStaged(null), []);
  const toggleSlow = useCallback(() => setSlow((current) => !current), []);

  const show = useCallback(
    async (scene: PreviewScene) => {
      const step = scene === "kursor" && staged?.scene === "kursor" ? staged.step + 1 : 0;
      const selector = sceneTargetSelector(scene, step);
      if (selector && !document.querySelector(selector)) {
        location.hash = "#/nilai";
        await nextPage();
      }
      setStaged({ scene, step, target: selector ? document.querySelector(selector) : null });
    },
    [staged],
  );

  const display: NemuDisplay | null = useMemo(
    () => staged && sceneDisplay(staged.scene, staged.step, { slow, toggleSlow, close }),
    [staged, slow, toggleSlow, close],
  );

  return { display, target: staged?.target ?? null, show, close };
}
