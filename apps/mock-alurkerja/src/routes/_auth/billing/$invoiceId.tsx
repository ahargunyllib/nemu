import { createFileRoute } from "@tanstack/react-router";
import OperationalRecord from "@/features/sla-claims/components/operational-record";
export const Route = createFileRoute("/_auth/billing/$invoiceId")({ component: Page });
function Page() {
  const { invoiceId } = Route.useParams();
  return <OperationalRecord kind="billing" recordId={invoiceId} />;
}
