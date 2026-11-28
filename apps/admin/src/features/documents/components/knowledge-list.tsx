import { Badge } from "@nemu/ui/components/badge";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@nemu/ui/components/card";
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
import { Tabs, TabsList, TabsTrigger } from "@nemu/ui/components/tabs";
import { FileTextIcon } from "lucide-react";
import { useState } from "react";

import KnowledgeStatusBadge from "@/features/documents/components/knowledge-status-badge";
import { formatDay } from "@/features/documents/lib/format";
import {
  formatChip,
  inTab,
  KNOWLEDGE_TABS,
  type KnowledgeItem,
  type KnowledgeTab,
  sourceLine,
  sortKnowledge,
} from "@/features/documents/lib/knowledge";

const SKELETON_ROWS = ["a", "b", "c", "d"];

/**
 * "Semua pengetahuan" (WS-04): the package's and the school's documents in one list, by kind.
 * Choosing a row opens it in the panel beside the list.
 */
export default function KnowledgeList({
  documents,
  selectedId,
  onSelect,
}: {
  documents: KnowledgeItem[] | undefined;
  selectedId: string | undefined;
  onSelect: (id: string) => void;
}) {
  const [tab, setTab] = useState<KnowledgeTab>("semua");
  const shown =
    documents && sortKnowledge(documents).filter((document) => inTab(tab, document.format));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Semua pengetahuan</CardTitle>
        <CardAction>
          <Tabs value={tab} onValueChange={(value) => setTab(value as KnowledgeTab)}>
            <TabsList>
              {KNOWLEDGE_TABS.map(({ value, label }) => (
                <TabsTrigger key={value} value={value}>
                  {label}{" "}
                  {documents?.filter((document) => inTab(value, document.format)).length ?? ""}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </CardAction>
      </CardHeader>
      <CardContent>
        {shown?.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FileTextIcon />
              </EmptyMedia>
              <EmptyTitle>Belum ada pengetahuan di sini</EmptyTitle>
              <EmptyDescription>
                Unggah PDF atau BPMN, atau rekam cara dari Nemu di halaman AlurSekolah.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead>Diperbarui</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown
                ? shown.map((document) => {
                    const selected = document.id === selectedId;
                    return (
                      <TableRow
                        key={document.id}
                        data-state={selected ? "selected" : undefined}
                        className="cursor-pointer data-[state=selected]:shadow-[inset_3px_0_0_var(--primary)]"
                        onClick={() => onSelect(document.id)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Badge variant="outline" className="w-12 justify-center">
                              {formatChip(document.format)}
                            </Badge>
                            <div>
                              <button
                                type="button"
                                aria-pressed={selected}
                                className="text-left font-medium outline-none focus-visible:underline"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  onSelect(document.id);
                                }}
                              >
                                {document.title}
                              </button>
                              <div className="text-muted-foreground">{sourceLine(document)}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDay(document.updatedAt)}
                        </TableCell>
                        <TableCell>
                          <KnowledgeStatusBadge document={document} />
                        </TableCell>
                      </TableRow>
                    );
                  })
                : SKELETON_ROWS.map((key) => (
                    <TableRow key={key}>
                      <TableCell colSpan={3}>
                        <Skeleton className="h-9 w-full" />
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
