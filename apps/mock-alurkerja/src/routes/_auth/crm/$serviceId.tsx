import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@nemu/ui/components/breadcrumb";
import { Skeleton } from "@nemu/ui/components/skeleton";
import { PageHeading } from "@nemu/ui/shell/page-heading";
import { createFileRoute } from "@tanstack/react-router";

import ClaimOriginBanner from "@/features/sla-claims/components/claim-origin-banner";
import CrmServiceRecord from "@/features/sla-claims/components/crm-service-record";
import { useSlaClaimForRecord } from "@/features/sla-claims/hooks/use-sla-claim-for-record";
import { CRM_SERVICES } from "@/features/sla-claims/lib/crm-records";

export const Route = createFileRoute("/_auth/crm/$serviceId")({ component: Page });

/** A service's CRM Layanan record, opened from (and leading back to) its claim Task. */
function Page() {
  const { serviceId } = Route.useParams();
  const data = useSlaClaimForRecord("crm", serviceId);
  const location = CRM_SERVICES[serviceId]?.location;

  return (
    <>
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>CRM Layanan</BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            {data ? data.claim.customer : <Skeleton className="h-4 w-28" />}
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{serviceId}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      {data ? (
        <>
          {data.task.status !== "SELESAI" && (
            <ClaimOriginBanner claimId={data.claim.id} taskName={data.task.name} />
          )}
          <PageHeading title={location ? `${serviceId} · ${location}` : serviceId} />
          <CrmServiceRecord
            customer={data.claim.customer}
            serviceId={data.claim.serviceId}
            contractId={data.context.service.contractId}
            addendumId={data.context.service.addendumId}
            effectiveSlaBasisPoints={data.context.service.effectiveSlaBasisPoints}
            monthlyFeeIdr={data.context.invoice.monthlyFeeIdr}
          />
        </>
      ) : (
        <>
          <Skeleton className="h-13 w-full rounded-2xl" />
          <Skeleton className="h-8 w-96" />
          <Skeleton className="h-9 w-80 rounded-4xl" />
          <Skeleton className="h-56 w-full rounded-4xl" />
        </>
      )}
    </>
  );
}
