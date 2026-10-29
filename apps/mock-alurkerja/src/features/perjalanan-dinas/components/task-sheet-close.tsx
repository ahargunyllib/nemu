import { NEMU_IDS } from "@nemu/contracts/nemu-ids";
import { Button } from "@nemu/ui/components/button";
import { SheetClose } from "@nemu/ui/components/sheet";
import { XIcon } from "lucide-react";

/** Closes the task sheet; the task route then goes back to Tugas Saya. */
export default function TaskSheetClose({ className }: { className?: string }) {
  return (
    <SheetClose
      data-nemu-id={NEMU_IDS.taskDetail.back}
      aria-label="Kembali ke Tugas Saya"
      render={<Button variant="ghost" size="icon-sm" className={className} />}
    >
      <XIcon />
    </SheetClose>
  );
}
