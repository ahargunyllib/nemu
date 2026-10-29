import { NEMU_IDS } from "@nemu/contracts/nemu-ids";
import { Badge } from "@nemu/ui/components/badge";
import { Button, buttonVariants } from "@nemu/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@nemu/ui/components/card";
import { Skeleton } from "@nemu/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@nemu/ui/components/table";
import { cn } from "@nemu/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";

import { orpc } from "@/shared/api/orpc";

const TICKET_ID: Record<string, string> = {
  "INC-2609-014": NEMU_IDS.slaClaim.ticketInc2609014,
  "INC-2609-015": NEMU_IDS.slaClaim.ticketInc2609015,
  "INC-2609-031": NEMU_IDS.slaClaim.ticketInc2609031,
  "INC-2609-047": NEMU_IDS.slaClaim.ticketInc2609047,
  "INC-2609-058": NEMU_IDS.slaClaim.ticketInc2609058,
};

export function CrmOperationalRecord({
  customer,
  serviceId,
  contractId,
  addendumId,
  effectiveSlaBasisPoints,
}: {
  customer: string;
  serviceId: string;
  contractId: string;
  addendumId: string | null;
  effectiveSlaBasisPoints: number;
}) {
  const [contractOpen, setContractOpen] = useState(false);
  const effectiveSla = (effectiveSlaBasisPoints / 100).toLocaleString("id-ID", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>CRM Layanan</CardTitle>
        <CardDescription>
          {customer} · {serviceId}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2">
          <dt className="text-muted-foreground">Kontrak</dt>
          <dd>{contractId}</dd>
          <dt className="text-muted-foreground">SLA dasar</dt>
          <dd>99%</dd>
        </dl>
        {contractOpen ? (
          <section id="contract" className="rounded-2xl border p-4">
            <h2 className="font-medium">Kontrak &amp; Adendum</h2>
            <p className="mt-2 text-muted-foreground">
              {addendumId ?? "Tanpa adendum"} menetapkan SLA berlaku
              {` ${effectiveSla}%`}.
            </p>
          </section>
        ) : (
          <Button
            type="button"
            variant="outline"
            data-nemu-id={NEMU_IDS.slaClaim.crmContractTab}
            onClick={() => setContractOpen(true)}
          >
            Buka Kontrak &amp; Adendum
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export default function OperationalRecord({
  kind,
  recordId,
}: {
  kind: "crm" | "noc" | "billing";
  recordId: string;
}) {
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
  if (!data) return <Skeleton className="h-72 w-full" />;
  const back = (
    <Link
      to="/sla-claims/$claimId"
      params={{ claimId: data.claim.id }}
      data-nemu-id={NEMU_IDS.slaClaim.returnToTask}
      className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
    >
      Kembali ke task klaim
    </Link>
  );

  if (kind === "crm")
    return (
      <>
        <CrmOperationalRecord
          customer={data.claim.customer}
          serviceId={data.claim.serviceId}
          contractId={data.context.service.contractId}
          addendumId={data.context.service.addendumId}
          effectiveSlaBasisPoints={data.context.service.effectiveSlaBasisPoints}
        />
        {back}
      </>
    );

  if (kind === "billing")
    return (
      <>
        <Card>
          <CardHeader>
            <CardTitle>Billing</CardTitle>
            <CardDescription>Invoice periode klaim</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2">
              <dt className="text-muted-foreground">Invoice</dt>
              <dd>{data.claim.invoiceId}</dd>
              <dt className="text-muted-foreground">Service ID</dt>
              <dd>{data.claim.serviceId}</dd>
              <dt className="text-muted-foreground">Periode</dt>
              <dd>{data.claim.period}</dd>
              <dt className="text-muted-foreground">Abonemen sebelum PPN</dt>
              <dd>Rp{data.context.invoice.monthlyFeeIdr.toLocaleString("id-ID")}</dd>
            </dl>
          </CardContent>
        </Card>
        {back}
      </>
    );

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Tiket NOC</CardTitle>
          <CardDescription>
            {data.claim.serviceId} · periode {data.claim.period}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tiket</TableHead>
                <TableHead>Penyebab</TableHead>
                <TableHead>RCA</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.context.tickets.map((ticket) => (
                <TableRow key={ticket.id} data-nemu-id={TICKET_ID[ticket.id]}>
                  <TableCell>{ticket.id}</TableCell>
                  <TableCell>{ticket.cause}</TableCell>
                  <TableCell>
                    <Badge variant={ticket.rcaStatus === "DISAHKAN" ? "secondary" : "destructive"}>
                      {ticket.rcaStatus}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      {back}
    </>
  );
}
