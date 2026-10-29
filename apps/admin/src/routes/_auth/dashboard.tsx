import { PageHeading } from "@nemu/ui/shell/page-heading";
import { createFileRoute } from "@tanstack/react-router";

import DocumentStats from "@/features/documents/components/document-stats";
import DocumentUploadDialog from "@/features/documents/components/document-upload-dialog";
import RecentDocuments from "@/features/documents/components/recent-documents";
import ServiceStatusCard from "@/features/health/components/service-status-card";

const kickerDate = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

export const Route = createFileRoute("/_auth/dashboard")({
  component: RouteComponent,
});

function RouteComponent() {
  const { session } = Route.useRouteContext();
  const firstName = session.data?.user.name.split(/\s+/)[0];

  return (
    <>
      <PageHeading
        kicker={`Admin dashboard · ${kickerDate.format(new Date()).replace(",", "")}`}
        title={`Good morning, ${firstName}.`}
        description="Here's what Nemu knows today."
        actions={<DocumentUploadDialog />}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DocumentStats />
        <ServiceStatusCard />
      </div>
      <RecentDocuments />
    </>
  );
}
