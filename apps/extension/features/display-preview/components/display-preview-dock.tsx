import { Button } from "@nemu/ui/components/button";

import { PREVIEW_SCENES, type PreviewScene } from "../lib/preview-scenes";

type DisplayPreviewDockProps = {
  onShow: (scene: PreviewScene) => void;
  onClose: () => void;
};

/** Dev-only buttons at the bottom left that show each display type on the page (#201). */
export function DisplayPreviewDock({ onShow, onClose }: DisplayPreviewDockProps) {
  return (
    <div
      aria-label="Pratinjau tampilan Nemu"
      className="pointer-events-auto fixed bottom-6 left-6 z-[2147483647] flex flex-wrap items-center gap-2 font-sans"
    >
      {PREVIEW_SCENES.map(({ scene, label }) => (
        <Button
          key={scene}
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onShow(scene)}
          className="bg-background shadow-nemu-float"
        >
          {label}
        </Button>
      ))}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onClose}
        className="bg-background shadow-nemu-float"
      >
        Kosongkan
      </Button>
    </div>
  );
}
