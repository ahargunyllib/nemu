import { Badge } from "@nemu/ui/components/badge";
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

import RuleSourceDialog from "@/features/rule-sources/components/rule-source-dialog";
import { orpc } from "@/shared/api/orpc";

const SKELETON_ROWS = ["a", "b", "c", "d"];

function formatLocation(article: string | null, page: number | null) {
  return [article, page && `hlm. ${page}`].filter(Boolean).join(" · ");
}

export default function RuleSourceList() {
  const sources = useQuery(orpc.listRuleSources.queryOptions());
  const missing = sources.data?.filter((source) => !source.citationId).length ?? 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sumber aturan</CardTitle>
        <CardDescription>
          {missing > 0
            ? `${missing} aturan belum punya sumber aktif, jadi Nemu belum bisa menghitungnya.`
            : "Aturan ini dihitung oleh kode Nemu, bukan dibuat AI. Tiap baris menunjuk pasal yang dikutip Nemu. Mengedit hanya mengganti pasal yang dikutip. Kalau SOP direvisi, arahkan ke dokumen atau pasal yang baru."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Aturan</TableHead>
              <TableHead>Dokumen</TableHead>
              <TableHead>Lokasi</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-0" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sources.data
              ? sources.data.map((source) => (
                  <TableRow key={source.key}>
                    <TableCell className="font-medium">{source.label}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span>{source.documentTitle ?? source.documentId}</span>
                        {source.isDefault && <Badge variant="outline">Bawaan</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatLocation(source.article, source.page) || "Seluruh dokumen"}
                    </TableCell>
                    <TableCell>
                      {source.citationId ? (
                        <Badge variant="secondary">Ditemukan</Badge>
                      ) : (
                        <Badge variant="destructive">Tidak ditemukan</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <RuleSourceDialog source={source} />
                    </TableCell>
                  </TableRow>
                ))
              : SKELETON_ROWS.map((key) => (
                  <TableRow key={key}>
                    <TableCell colSpan={5}>
                      <Skeleton className="h-6 w-full" />
                    </TableCell>
                  </TableRow>
                ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
