import { PageHeading } from "@nemu/ui/shell/page-heading";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { listKnowledgeQueryOptions } from "@/features/documents/api/list-documents";
import DocumentUploadDialog from "@/features/documents/components/document-upload-dialog";
import KnowledgeList from "@/features/documents/components/knowledge-list";
import KnowledgePanel from "@/features/documents/components/knowledge-panel";
import KnowledgePanelEmpty from "@/features/documents/components/knowledge-panel-empty";
import KnowledgeStats from "@/features/documents/components/knowledge-stats";
import PanelSection from "@/features/documents/components/panel-section";
import ProcessPanelBody from "@/features/documents/components/process-panel-body";
import ProcessSummaryLine from "@/features/documents/components/process-summary-line";
import RecordProcedureDialog from "@/features/documents/components/record-procedure-dialog";
import RuleSourceList from "@/features/rule-sources/components/rule-source-list";

/** `dokumen`: the row open in the panel beside the list. */
const searchSchema = z.object({ dokumen: z.string().optional() });

export const Route = createFileRoute("/_auth/documents")({
  validateSearch: searchSchema,
  component: RouteComponent,
});

function RouteComponent() {
  const { dokumen } = Route.useSearch();
  const navigate = Route.useNavigate();
  const documents = useQuery(listKnowledgeQueryOptions());
  const selected = documents.data?.find((document) => document.id === dokumen);
  const isProcess = selected?.format === "bpmn" && selected.status === "ready";

  return (
    <>
      <PageHeading
        title="Dokumen dan alur"
        actions={
          <>
            <DocumentUploadDialog kind="pdf" variant="outline" />
            <DocumentUploadDialog kind="bpmn" variant="outline" />
            <RecordProcedureDialog />
          </>
        }
      />
      <KnowledgeStats />
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <KnowledgeList
          documents={documents.data}
          selectedId={selected?.id}
          onSelect={(id) => navigate({ search: { dokumen: id }, replace: true })}
        />
        {selected ? (
          <KnowledgePanel
            key={selected.id}
            document={selected}
            summary={
              isProcess ? (
                <ProcessSummaryLine id={selected.id} version={selected.version} />
              ) : undefined
            }
          >
            {isProcess && <ProcessPanelBody documentId={selected.id} />}
            {(selected.format === "pdf" || selected.format === "md") && (
              <PanelSection title="Aturan hitung yang mengutip dokumen ini">
                <RuleSourceList documentId={selected.id} />
              </PanelSection>
            )}
          </KnowledgePanel>
        ) : (
          <KnowledgePanelEmpty>
            <PanelSection title="Aturan hitung dan sumbernya">
              <RuleSourceList />
            </PanelSection>
          </KnowledgePanelEmpty>
        )}
      </div>
    </>
  );
}
