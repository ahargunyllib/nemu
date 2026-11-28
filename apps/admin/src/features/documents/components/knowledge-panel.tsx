import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@nemu/ui/components/card";
import { Label } from "@nemu/ui/components/label";
import type { ReactNode } from "react";

import {
  DocumentActiveSwitch,
  DocumentDeleteButton,
  DocumentExportBpmnButton,
  DocumentOpenButton,
} from "@/features/documents/components/document-row-controls";
import DocumentSitesDialog from "@/features/documents/components/document-sites-dialog";
import DocumentUploadDialog from "@/features/documents/components/document-upload-dialog";
import KnowledgeStatusBadge from "@/features/documents/components/knowledge-status-badge";
import ProcessElementsSheet from "@/features/documents/components/process-elements-sheet";
import { formatDay } from "@/features/documents/lib/format";
import { sourceLine } from "@/features/documents/lib/knowledge";
import type { KnowledgeDocument } from "@/features/documents/types/knowledge";

/**
 * The panel beside "Semua pengetahuan": the chosen document's kind, version and uploader, what
 * Nemu knows from it (`children`), and its controls. A package document is read-only for an
 * operator. `summary` replaces the kind and version line, e.g. with a BPMN's task count.
 */
export default function KnowledgePanel({
  document,
  summary,
  children,
}: {
  document: KnowledgeDocument;
  summary?: ReactNode;
  children?: ReactNode;
}) {
  const by = document.createdByName ?? "sistem";
  const ready = document.status === "ready";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{document.title}</CardTitle>
        <CardAction>
          <KnowledgeStatusBadge document={document} />
        </CardAction>
        <CardDescription>
          <div>{summary ?? `${sourceLine(document)} · versi ${document.version}`}</div>
          <div>
            {document.packageId
              ? `Paket bawaan · dipasang ${by}, ${formatDay(document.createdAt)}`
              : `${document.format === "procedure" ? "Direkam" : "Diunggah"} ${by}, ${formatDay(document.createdAt)}`}
          </div>
          {document.status === "failed" && document.failureReason && (
            <div className="text-destructive">{document.failureReason}</div>
          )}
        </CardDescription>
      </CardHeader>
      {children && <CardContent className="grid gap-6">{children}</CardContent>}
      <CardFooter className="flex flex-wrap items-center gap-2 border-t">
        {document.readOnly ? (
          <p className="mr-auto text-muted-foreground">
            Paket bawaan: hanya Admin Javan yang bisa mengubahnya.
          </p>
        ) : (
          <>
            <Label className="mr-2 flex items-center gap-2">
              <DocumentActiveSwitch id={document.id} isActive={document.isActive} />
              Aktif
            </Label>
            <DocumentSitesDialog
              id={document.id}
              title={document.title}
              siteIds={document.siteIds}
            />
          </>
        )}
        <div className="ml-auto flex gap-1">
          {ready && document.format === "bpmn" && (
            <ProcessElementsSheet id={document.id} title={document.title} />
          )}
          {!document.readOnly && document.format !== "procedure" && (
            <DocumentUploadDialog
              packageId={document.packageId === null ? null : "alursekolah"}
              nextVersionOf={document.title}
            />
          )}
          {ready && document.format !== "procedure" && (
            <DocumentOpenButton id={document.id} title={document.title} />
          )}
          {ready && document.format === "procedure" && (
            <DocumentExportBpmnButton id={document.id} title={document.title} />
          )}
          {!document.readOnly && <DocumentDeleteButton id={document.id} title={document.title} />}
        </div>
      </CardFooter>
    </Card>
  );
}
