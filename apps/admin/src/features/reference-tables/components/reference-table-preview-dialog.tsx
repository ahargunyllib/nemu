import type { ReferenceTableType } from "@nemu/api/modules/reference-tables/table-types";
import { Button } from "@nemu/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@nemu/ui/components/dialog";
import { Skeleton } from "@nemu/ui/components/skeleton";
import { useQuery } from "@tanstack/react-query";
import { EyeIcon } from "lucide-react";
import { useState } from "react";

import ReferenceTablePreview from "@/features/reference-tables/components/reference-table-preview";
import { orpc } from "@/shared/api/orpc";

const SKELETON_ROWS = ["a", "b", "c", "d", "e"];

export default function ReferenceTablePreviewDialog({
  type,
  label,
}: {
  type: ReferenceTableType;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const table = useQuery(orpc.getReferenceTable.queryOptions({ input: { type }, enabled: open }));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button variant="ghost" size="icon-sm" aria-label={`Preview ${label}`} />}
      >
        <EyeIcon />
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
          <DialogDescription>
            {table.data ? `${table.data.fileName} · ${table.data.rowCount} rows` : "Loading rows…"}
          </DialogDescription>
        </DialogHeader>
        {table.data ? (
          <ReferenceTablePreview columns={table.data.columns} rows={table.data.rows} />
        ) : (
          <div className="grid gap-2">
            {SKELETON_ROWS.map((key) => (
              <Skeleton key={key} className="h-8 w-full" />
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
