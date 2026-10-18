import { Button } from "@nemu/ui/components/button";
import { XIcon } from "lucide-react";

/** The card's only control: the close × at its top-right. */
export function AnswerCardHeader({ onClose }: { onClose: () => void }) {
  return (
    <Button
      aria-label="Tutup"
      size="icon-xs"
      variant="ghost"
      className="-mt-0.5 -mr-1 ml-auto shrink-0 text-muted-foreground"
      onClick={onClose}
    >
      <XIcon />
    </Button>
  );
}
