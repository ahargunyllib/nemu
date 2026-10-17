import { createFileRoute } from "@tanstack/react-router";

import DocumentStats from "@/features/documents/components/document-stats";
import DocumentUploadDialog from "@/features/documents/components/document-upload-dialog";
import RecentDocuments from "@/features/documents/components/recent-documents";
import ServiceStatusCard from "@/features/health/components/service-status-card";
import PageHeader from "@/shared/components/page-header";

export const Route = createFileRoute("/_auth/dashboard")({
  component: RouteComponent,
});

function RouteComponent() {
  const { session } = Route.useRouteContext();

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`Welcome back, ${session.data?.user.name}. Here's what Nemu knows today.`}
      >
        <DocumentUploadDialog />
      </PageHeader>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DocumentStats />
        <ServiceStatusCard />
      </div>
      <RecentDocuments />
    </>
  );
}
