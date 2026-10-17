import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
} from "@nemu/ui/components/attachment";
import { CropIcon, XIcon } from "lucide-react";

import type { AreaCropState } from "../hooks/use-area-crop";

type AreaCropChipProps = {
  state: Extract<AreaCropState, { kind: "attached" } | { kind: "failed" }>;
  onRemove: () => void;
};

/** The Area Crop attached to the next prompt, shown in the Composer until removed or sent. */
export function AreaCropChip({ state, onRemove }: AreaCropChipProps) {
  const attached = state.kind === "attached";

  return (
    <Attachment size="xs" state={attached ? "done" : "error"}>
      <AttachmentMedia variant={attached ? "image" : "icon"}>
        {attached ? <img alt="Area Crop" src={state.crop} /> : <CropIcon />}
      </AttachmentMedia>
      <AttachmentContent>
        <AttachmentTitle>Area Crop</AttachmentTitle>
        <AttachmentDescription>
          {attached ? "Dikirim bersama pertanyaan" : "Area gagal diambil. Coba pilih lagi."}
        </AttachmentDescription>
      </AttachmentContent>
      <AttachmentActions>
        <AttachmentAction aria-label="Hapus Area Crop" onClick={onRemove}>
          <XIcon />
        </AttachmentAction>
      </AttachmentActions>
    </Attachment>
  );
}
