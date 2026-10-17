import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@nemu/ui/components/card";
import { Skeleton } from "@nemu/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@nemu/ui/components/table";
import { useQuery } from "@tanstack/react-query";

import { listReferenceTablesQueryOptions } from "@/features/reference-tables/api/list-reference-tables";
import ReferenceTablePreviewDialog from "@/features/reference-tables/components/reference-table-preview-dialog";

const SKELETON_ROWS = ["a", "b", "c", "d", "e"];

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

export default function ReferenceTableList() {
  const tables = useQuery(listReferenceTablesQueryOptions());

  return (
    <Card>
      <CardHeader>
        <CardTitle>All tables</CardTitle>
        <CardDescription>
          {tables.data
            ? `${tables.data.filter((table) => table.stored).length} of ${tables.data.length} tables stored`
            : "SBM 2026 and holiday calendar tables."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Table</TableHead>
              <TableHead>File</TableHead>
              <TableHead>Rows</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead className="w-0" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {tables.data
              ? tables.data.map((table) => (
                  <TableRow key={table.type}>
                    <TableCell>
                      <div className="font-medium">{table.label}</div>
                      <div className="text-muted-foreground">{table.description}</div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {table.stored?.fileName ?? "Not uploaded"}
                    </TableCell>
                    <TableCell>{table.stored?.rowCount ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {table.stored ? dateFormat.format(table.stored.updatedAt) : "—"}
                    </TableCell>
                    <TableCell>
                      {table.stored && (
                        <ReferenceTablePreviewDialog type={table.type} label={table.label} />
                      )}
                    </TableCell>
                  </TableRow>
                ))
              : SKELETON_ROWS.map((key) => (
                  <TableRow key={key}>
                    <TableCell colSpan={5}>
                      <Skeleton className="h-10 w-full" />
                    </TableCell>
                  </TableRow>
                ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
