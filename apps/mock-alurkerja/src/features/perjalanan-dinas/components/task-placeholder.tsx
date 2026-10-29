import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@nemu/ui/components/empty";
import { ClipboardListIcon } from "lucide-react";

/** Fills My Task beside the Task column when there are no Tasks yet, saying so. */
export default function TaskPlaceholder() {
  return (
    <Empty className="border bg-background">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <ClipboardListIcon />
        </EmptyMedia>
        <EmptyTitle>Tidak ada tugas</EmptyTitle>
        <EmptyDescription>Tugas baru akan muncul di sini.</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
