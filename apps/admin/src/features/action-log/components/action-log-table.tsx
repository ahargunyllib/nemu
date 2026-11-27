import { Badge } from "@nemu/ui/components/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@nemu/ui/components/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@nemu/ui/components/empty";
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
import { ListChecksIcon } from "lucide-react";

import { type ActionResult, actionLabel, RESULT_LABELS } from "@/features/action-log/lib/labels";
import { formatDate } from "@/features/documents/lib/format";
import { orpc } from "@/shared/api/orpc";

const SKELETON_ROWS = ["a", "b", "c", "d"];

function resultVariant(result: ActionResult) {
  if (result === "done") return "secondary" as const;
  if (result === "failed") return "destructive" as const;
  return "outline" as const;
}

/** WS-10: every action Nemu took on a page, newest first. It names fields, never their values. */
export default function ActionLogTable() {
  const log = useQuery(orpc.listActionLog.queryOptions());

  return (
    <Card>
      <CardHeader>
        <CardTitle>Log tindakan</CardTitle>
        <CardDescription>
          {log.data
            ? `${log.data.length} tindakan terbaru. Nilai yang diketik tidak pernah dicatat.`
            : "Setiap tindakan Nemu di halaman: siapa, kapan, di situs mana, dan hasilnya."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {log.data?.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ListChecksIcon />
              </EmptyMedia>
              <EmptyTitle>Belum ada tindakan</EmptyTitle>
              <EmptyDescription>
                Tindakan Nemu muncul di sini setelah guru memakainya.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Waktu</TableHead>
                <TableHead>Guru</TableHead>
                <TableHead>Situs</TableHead>
                <TableHead>Tugas</TableHead>
                <TableHead>Tindakan</TableHead>
                <TableHead>Cara</TableHead>
                <TableHead>Hasil</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {log.data
                ? log.data.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {formatDate(row.actedAt)}
                      </TableCell>
                      <TableCell>{row.teacherName}</TableCell>
                      <TableCell className="font-mono text-muted-foreground">
                        {row.website}
                      </TableCell>
                      <TableCell className="whitespace-normal">{row.task}</TableCell>
                      <TableCell className="whitespace-normal">
                        {actionLabel(row.action)}
                        {row.target && (
                          <span className="text-muted-foreground"> · {row.target}</span>
                        )}
                      </TableCell>
                      <TableCell>{row.cara}</TableCell>
                      <TableCell>
                        <Badge variant={resultVariant(row.result)}>
                          {RESULT_LABELS[row.result]}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                : SKELETON_ROWS.map((key) => (
                    <TableRow key={key}>
                      <TableCell colSpan={7}>
                        <Skeleton className="h-6 w-full" />
                      </TableCell>
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
