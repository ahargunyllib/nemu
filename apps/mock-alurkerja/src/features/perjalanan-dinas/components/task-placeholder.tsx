import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@nemu/ui/components/empty";
import { ClipboardListIcon, MousePointerClickIcon } from "lucide-react";

/**
 * Fills My Task beside the Task column, where the Task sheet opens: it asks to pick a Task, or says
 * there are none yet.
 */
export default function TaskPlaceholder({ hasTasks }: { hasTasks: boolean }) {
  return (
    <Empty className="border bg-background">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          {hasTasks ? <MousePointerClickIcon /> : <ClipboardListIcon />}
        </EmptyMedia>
        <EmptyTitle>{hasTasks ? "Pilih tugas" : "Tidak ada tugas"}</EmptyTitle>
        <EmptyDescription>
          {hasTasks
            ? "Pilih tugas di daftar untuk membuka detailnya di sini."
            : "Tugas baru akan muncul di sini."}
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
