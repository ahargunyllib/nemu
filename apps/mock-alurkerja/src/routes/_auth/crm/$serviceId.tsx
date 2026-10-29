import { createFileRoute } from "@tanstack/react-router";
import OperationalRecord from "@/features/sla-claims/components/operational-record";
export const Route = createFileRoute("/_auth/crm/$serviceId")({ component: Page });
function Page() {
  const { serviceId } = Route.useParams();
  return <OperationalRecord kind="crm" recordId={serviceId} />;
}
