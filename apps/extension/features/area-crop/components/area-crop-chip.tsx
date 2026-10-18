import { Button } from "@nemu/ui/components/button";
import { CropIcon, XIcon } from "lucide-react";

import type { AreaCropState } from "../hooks/use-area-crop";

type AreaCropChipProps = {
  state: Extract<AreaCropState, { kind: "attached" } | { kind: "failed" }>;
  onRemove: () => void;
};

/**
 * The Area Crop attached to the next prompt, until removed or sent: the top of the Kartu area,
 * with the cropped thumbnail top-left and a close × top-right.
 */
export function AreaCropChip({ state, onRemove }: AreaCropChipProps) {
  return (
    <div className="flex items-start justify-between gap-2">
      {state.kind === "attached" ? (
        <img
          alt="Area Crop"
          src={state.crop}
          className="h-16 w-auto max-w-48 rounded-xl object-cover ring-1 ring-foreground/10"
        />
      ) : (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-destructive/10">
            <CropIcon className="size-4" />
          </span>
          Area gagal diambil. Coba pilih lagi.
        </div>
      )}
      <Button aria-label="Hapus Area Crop" size="icon-sm" variant="ghost" onClick={onRemove}>
        <XIcon />
      </Button>
    </div>
  );
}
