import { Badge } from "@nemu/ui/components/badge";
import {
  Card,
  CardAction,
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
import { InputGroup, InputGroupAddon, InputGroupInput } from "@nemu/ui/components/input-group";
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
import { FileTextIcon, SearchIcon } from "lucide-react";
import { useState } from "react";

import {
  type DocumentScope,
  listDocumentsQueryOptions,
} from "@/features/documents/api/list-documents";
import {
  DocumentActiveSwitch,
  DocumentDeleteButton,
  DocumentExportBpmnButton,
  DocumentOpenButton,
} from "@/features/documents/components/document-row-controls";
import DocumentSitesDialog from "@/features/documents/components/document-sites-dialog";
import DocumentStatusBadge from "@/features/documents/components/document-status-badge";
import DocumentUploadDialog from "@/features/documents/components/document-upload-dialog";
import ProcessElementsSheet from "@/features/documents/components/process-elements-sheet";
import { formatDate, formatLabel, formatSize } from "@/features/documents/lib/format";

const SKELETON_ROWS = ["a", "b", "c"];

/**
 * WS-04 (and WS-02 for the package): BPMN, PDF and recordings, each with its websites, version,
 * active switch, and who uploaded and last switched it.
 */
export default function DocumentList({
  packageId = null,
  title,
  initialQuery = "",
}: {
  packageId?: DocumentScope;
  title: string;
  /** What the search box starts with, such as a title picked in the top bar's search. */
  initialQuery?: string;
}) {
  const documents = useQuery(listDocumentsQueryOptions(packageId));
  const [query, setQuery] = useState(initialQuery);

  const filtered = documents.data?.filter((document) =>
    `${document.title} ${document.fileName}`.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>
          {documents.data
            ? `${documents.data.length} dokumen · ${documents.data.filter((d) => d.isActive).length} aktif`
            : "Dokumen yang diunggah dan statusnya."}
        </CardDescription>
        <CardAction>
          <InputGroup className="w-48 sm:w-64">
            <InputGroupAddon>
              <SearchIcon />
            </InputGroupAddon>
            <InputGroupInput
              aria-label="Cari dokumen"
              placeholder="Cari dokumen…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </InputGroup>
        </CardAction>
      </CardHeader>
      <CardContent>
        {filtered?.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FileTextIcon />
              </EmptyMedia>
              <EmptyTitle>{query ? "Tidak ada yang cocok" : "Belum ada dokumen"}</EmptyTitle>
              <EmptyDescription>
                {query
                  ? "Coba judul atau nama file lain."
                  : "Unggah PDF, Markdown, atau BPMN untuk memulai."}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Judul</TableHead>
                <TableHead>Versi</TableHead>
                <TableHead>Situs</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Aktif</TableHead>
                <TableHead>Siapa dan kapan</TableHead>
                <TableHead className="w-0" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered
                ? filtered.map((document) => (
                    <TableRow key={document.id}>
                      <TableCell>
                        <div className="flex items-center gap-2 font-medium">
                          {document.title}
                          <Badge variant="secondary">{formatLabel(document.format)}</Badge>
                        </div>
                        <div className="text-muted-foreground">
                          {document.fileName} · {formatSize(document.sizeBytes)}
                        </div>
                      </TableCell>
                      <TableCell>{document.version}</TableCell>
                      <TableCell className="whitespace-normal">
                        <DocumentSitesDialog
                          id={document.id}
                          title={document.title}
                          siteIds={document.siteIds}
                        />
                      </TableCell>
                      <TableCell>
                        <DocumentStatusBadge
                          status={document.status}
                          failureReason={document.failureReason}
                        />
                      </TableCell>
                      <TableCell>
                        <DocumentActiveSwitch id={document.id} isActive={document.isActive} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        <div>
                          Diunggah {document.createdByName ?? "sistem"} ·{" "}
                          {formatDate(document.createdAt)}
                        </div>
                        <div>
                          {document.isActive ? "Diaktifkan" : "Diubah"}{" "}
                          {document.changedByName ?? "sistem"} · {formatDate(document.updatedAt)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          {document.format === "bpmn" && document.status === "ready" && (
                            <ProcessElementsSheet id={document.id} title={document.title} />
                          )}
                          {document.format !== "procedure" && (
                            <DocumentUploadDialog
                              packageId={packageId}
                              nextVersionOf={document.title}
                            />
                          )}
                          {document.status === "ready" && document.format !== "procedure" && (
                            <DocumentOpenButton id={document.id} title={document.title} />
                          )}
                          {document.status === "ready" && document.format === "procedure" && (
                            <DocumentExportBpmnButton id={document.id} title={document.title} />
                          )}
                          <DocumentDeleteButton id={document.id} title={document.title} />
                        </div>
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
