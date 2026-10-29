import { Button } from "@nemu/ui/components/button";
import { CropIcon, XIcon } from "lucide-react";

import type { AreaCropState } from "../hooks/use-area-crop";

type AreaCropChipProps = {
  state: Extract<AreaCropState, { kind: "attached" } | { kind: "failed" }>;
  onRemove: () => void;
};

/**
 * The Area Crop attached to the next prompt, until removed or sent: the top of the Kartu area,
 * with a small thumbnail of the whole crop top-left and a close × top-right.
 */
export function AreaCropChip({ state, onRemove }: AreaCropChipProps) {
  return (
    <div className="flex items-start justify-between gap-2">
      {state.kind === "attached" ? (
        // Fit, not cover: cutting a wide crop to the thumbnail's middle often left only blank form.
        <img
          alt="Area Crop"
          src={state.crop}
          className="h-7 w-12 rounded-md border bg-muted object-contain"
        />
      ) : (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <span className="flex h-7 w-12 shrink-0 items-center justify-center rounded-md bg-destructive/10">
            <CropIcon className="size-4" />
          </span>
          Area gagal diambil. Coba pilih lagi.
        </div>
      )}
      <Button aria-label="Hapus Area Crop" size="icon-xs" variant="ghost" onClick={onRemove}>
        <XIcon />
      </Button>
    </div>
  );
}
