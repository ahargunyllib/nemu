import { useQuery } from "@tanstack/react-query";

import { orpc } from "@/shared/api/orpc";

/** The claim, with its detail, that a CRM, NOC, or Billing record belongs to. */
export function useSlaClaimForRecord(kind: "crm" | "noc" | "billing", recordId: string) {
  const { data: claims } = useQuery(
    orpc.listSlaClaims.queryOptions({ input: { workspaceId: "W-TELKO" } }),
  );
  const claim = claims?.find((item) =>
    kind === "billing" ? item.invoiceId === recordId : item.serviceId === recordId,
  );
  const { data } = useQuery(
    orpc.getSlaClaim.queryOptions({
      input: { workspaceId: "W-TELKO", claimId: claim?.id ?? "pending" },
      enabled: Boolean(claim),
    }),
  );
  return data;
}
