import { NEMU_IDS } from "@nemu/contracts/nemu-ids";
import { Badge } from "@nemu/ui/components/badge";
import { Button, buttonVariants } from "@nemu/ui/components/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@nemu/ui/components/card";
import { Field, FieldDescription, FieldLabel } from "@nemu/ui/components/field";
import { Input } from "@nemu/ui/components/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@nemu/ui/components/table";
import { cn } from "@nemu/ui/lib/utils";
import { useState } from "react";

type Ticket = {
  id: string;
  start: string;
  end: string;
  cause: string;
  rcaId: string | null;
  rcaStatus: string;
};

export type SlaClaimDetail = {
  claim: {
    id: string;
    customer: string;
    letterNumber: string;
    serviceId: string;
    period: string;
    receivedAt: string;
    claimedMinutes: number;
    invoiceId: string;
  };
  context: {
    service: {
      contractId: string;
      addendumId: string | null;
      effectiveSlaBasisPoints: number;
    };
    invoice: { monthlyFeeIdr: number };
    tickets: readonly Ticket[];
  };
  task: { id: string; name: string; status: string; reviewDueOn: string | null };
  summary: {
    cutoff: { period: string; receivedDate: string; deadline: string; timely: boolean };
    totalPeriodMinutes: number;
    allowedDowntimeMinutes: number;
    actualDowntimeMinutes: number;
    compensationAmount: number | null;
    missingTicketIds: string[];
    excludedTicketIds: string[];
    approvers: string[];
  };
};

const TICKET_NEMU_ID: Record<string, string> = {
  "INC-2609-014": NEMU_IDS.slaClaim.ticketInc2609014,
  "INC-2609-015": NEMU_IDS.slaClaim.ticketInc2609015,
  "INC-2609-031": NEMU_IDS.slaClaim.ticketInc2609031,
  "INC-2609-047": NEMU_IDS.slaClaim.ticketInc2609047,
  "INC-2609-058": NEMU_IDS.slaClaim.ticketInc2609058,
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(new Date(`${value.slice(0, 10)}T00:00:00+07:00`));
}

function hours(minutes: number): string {
  return (minutes / 60).toLocaleString("id-ID", { maximumFractionDigits: 4 });
}

function ReadOnlyField({
  id,
  label,
  value,
  nemuId,
  type = "text",
}: {
  id: string;
  label: string;
  value: string | number;
  nemuId: string;
  type?: string;
}) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input id={id} type={type} value={value} readOnly data-nemu-id={nemuId} />
    </Field>
  );
}

function Registration({ detail }: { detail: SlaClaimDetail }) {
  const { claim, summary } = detail;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Data surat klaim</CardTitle>
        <CardDescription>
          Nilai diambil dari klaim yang tersimpan di workspace Telco.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-5 sm:grid-cols-2">
          <ReadOnlyField
            id="claim-letter"
            label="Nomor surat"
            value={claim.letterNumber}
            nemuId={NEMU_IDS.slaClaim.letterNumber}
          />
          <ReadOnlyField
            id="claim-service"
            label="Service ID"
            value={claim.serviceId}
            nemuId={NEMU_IDS.slaClaim.serviceId}
          />
          <ReadOnlyField
            id="claim-period"
            label="Periode gangguan"
            value={claim.period}
            nemuId={NEMU_IDS.slaClaim.period}
            type="month"
          />
          <ReadOnlyField
            id="claim-received"
            label="Tanggal diterima"
            value={claim.receivedAt.slice(0, 10)}
            nemuId={NEMU_IDS.slaClaim.receivedAt}
            type="date"
          />
          <ReadOnlyField
            id="claim-hours"
            label="Jam yang diklaim"
            value={claim.claimedMinutes / 60}
            nemuId={NEMU_IDS.slaClaim.claimedHours}
            type="number"
          />
          <Field>
            <FieldLabel htmlFor="claim-letter-file">Surat klaim</FieldLabel>
            <Input
              id="claim-letter-file"
              type="file"
              accept=".pdf"
              data-nemu-id={NEMU_IDS.slaClaim.uploadLetter}
            />
            <FieldDescription>Dokumen sumber: {claim.letterNumber}</FieldDescription>
          </Field>
        </div>
        <Field>
          <FieldLabel>Diajukan tepat waktu?</FieldLabel>
          <div className="flex gap-6">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={summary.cutoff.timely}
                readOnly
                data-nemu-id={NEMU_IDS.slaClaim.timelyYes}
              />{" "}
              Ya
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={!summary.cutoff.timely}
                readOnly
                data-nemu-id={NEMU_IDS.slaClaim.timelyNo}
              />{" "}
              Tidak
            </label>
          </div>
          <FieldDescription>
            Batas pengajuan {formatDate(summary.cutoff.deadline)}.
          </FieldDescription>
        </Field>
      </CardContent>
    </Card>
  );
}

function ServiceMatch({ detail }: { detail: SlaClaimDetail }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Layanan dan kontrak</CardTitle>
        <CardDescription>Cocokkan sumber CRM dan invoice untuk periode klaim.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2">
          <dt className="text-muted-foreground">Service ID</dt>
          <dd>{detail.claim.serviceId}</dd>
          <dt className="text-muted-foreground">Kontrak</dt>
          <dd>{detail.context.service.contractId}</dd>
          <dt className="text-muted-foreground">Adendum</dt>
          <dd>{detail.context.service.addendumId ?? "Tidak ada"}</dd>
          <dt className="text-muted-foreground">SLA berlaku</dt>
          <dd>{detail.context.service.effectiveSlaBasisPoints / 100}%</dd>
          <dt className="text-muted-foreground">Invoice</dt>
          <dd>{detail.claim.invoiceId}</dd>
          <dt className="text-muted-foreground">Abonemen sebelum PPN</dt>
          <dd>Rp{detail.context.invoice.monthlyFeeIdr.toLocaleString("id-ID")}</dd>
        </dl>
        <a
          href={`/crm/${detail.claim.serviceId}`}
          data-nemu-id={NEMU_IDS.slaClaim.crmService}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          Buka CRM Layanan
        </a>
      </CardContent>
    </Card>
  );
}

function TicketReview({ detail }: { detail: SlaClaimDetail }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Tiket gangguan</CardTitle>
        <CardDescription>
          Interval tumpang tindih digabung dan gangguan pelanggan dikecualikan.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tiket</TableHead>
              <TableHead>Mulai</TableHead>
              <TableHead>Pulih</TableHead>
              <TableHead>Penyebab</TableHead>
              <TableHead>RCA</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {detail.context.tickets.map((ticket) => {
              const missing = detail.summary.missingTicketIds.includes(ticket.id);
              return (
                <TableRow key={ticket.id} data-nemu-id={TICKET_NEMU_ID[ticket.id]}>
                  <TableCell className="font-medium">{ticket.id}</TableCell>
                  <TableCell>{ticket.start.slice(5, 16).replace("T", " ")}</TableCell>
                  <TableCell>{ticket.end.slice(5, 16).replace("T", " ")}</TableCell>
                  <TableCell>{ticket.cause.replaceAll("_", " ")}</TableCell>
                  <TableCell>
                    <Badge variant={missing ? "destructive" : "secondary"}>
                      {ticket.rcaStatus}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {ticket.id === "INC-2609-058" && (
                      <Button
                        size="sm"
                        variant="outline"
                        data-nemu-id={NEMU_IDS.slaClaim.requestRcaInc2609058}
                      >
                        Minta RCA
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {detail.summary.missingTicketIds.length > 0 && (
          <p className="mt-4 text-destructive">
            Nominal belum dapat ditetapkan sampai RCA {detail.summary.missingTicketIds.join(", ")}{" "}
            disahkan.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function Calculation({ detail }: { detail: SlaClaimDetail }) {
  const { summary } = detail;
  const [compensationAmount, setCompensationAmount] = useState("");
  return (
    <Card>
      <CardHeader>
        <CardTitle>Perhitungan kompensasi</CardTitle>
        <CardDescription>
          Presisi desimal dipertahankan sampai pembulatan rupiah terakhir.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-2">
          <dt className="text-muted-foreground">Jam kalender bulan (C)</dt>
          <dd>{hours(summary.totalPeriodMinutes)} jam</dd>
          <dt className="text-muted-foreground">SLA berlaku</dt>
          <dd>{detail.context.service.effectiveSlaBasisPoints / 100}%</dd>
          <dt className="text-muted-foreground">Toleransi (Av)</dt>
          <dd>{hours(summary.allowedDowntimeMinutes)} jam</dd>
          <dt className="text-muted-foreground">Durasi dihitung (A)</dt>
          <dd>{hours(summary.actualDowntimeMinutes)} jam</dd>
          <dt className="text-muted-foreground">Abonemen (B)</dt>
          <dd>Rp{detail.context.invoice.monthlyFeeIdr.toLocaleString("id-ID")}</dd>
        </dl>
        {summary.compensationAmount === null ? (
          <p className="text-destructive">
            Nominal belum dapat ditetapkan karena bukti RCA belum lengkap.
          </p>
        ) : (
          <Field>
            <FieldLabel htmlFor="compensation">Nominal kompensasi</FieldLabel>
            <Input
              id="compensation"
              type="number"
              value={compensationAmount}
              onChange={(event) => setCompensationAmount(event.target.value)}
              data-nemu-id={NEMU_IDS.slaClaim.compensationAmount}
            />
            <FieldDescription>
              Hasil hitung Nemu: Rp{summary.compensationAmount.toLocaleString("id-ID")}
            </FieldDescription>
          </Field>
        )}
      </CardContent>
    </Card>
  );
}

function Rejection({ detail }: { detail: SlaClaimDetail }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Surat penolakan</CardTitle>
        <CardDescription>Klaim diterima setelah batas pengajuan.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p>
          Klaim periode {detail.claim.period} melewati batas{" "}
          {formatDate(detail.summary.cutoff.deadline)} dan tidak dilanjutkan ke telaah tiket.
        </p>
        <a
          href="#template-penolakan"
          data-nemu-id={NEMU_IDS.slaClaim.rejectionTemplate}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          Buka template TPL-BILL-02
        </a>
      </CardContent>
    </Card>
  );
}

export default function SlaClaimTask({
  detail,
  onAdvance,
  advancing = false,
}: {
  detail: SlaClaimDetail;
  onAdvance?: () => void;
  advancing?: boolean;
}) {
  const { task } = detail;
  const showCalculation = ["Susun Berita Acara", "Persetujuan", "Credit Note"].includes(task.name);
  return (
    <>
      <Card>
        <CardHeader>
          <h1 className="font-heading text-lg font-semibold">{task.name}</h1>
          <CardDescription>
            {detail.claim.id} · {detail.claim.customer}
          </CardDescription>
          <CardAction>
            <Badge variant={task.status === "PERLU_BUKTI" ? "destructive" : "secondary"}>
              {task.status}
            </Badge>
          </CardAction>
        </CardHeader>
      </Card>
      {task.name === "Registrasi Klaim" && <Registration detail={detail} />}
      {task.name === "Cocokkan Layanan & Kontrak" && <ServiceMatch detail={detail} />}
      {task.name === "Telaah Tiket Gangguan" && <TicketReview detail={detail} />}
      {showCalculation && <Calculation detail={detail} />}
      {task.name === "Surat Penolakan" && <Rejection detail={detail} />}
      {task.name === "Persetujuan" && (
        <Button disabled data-nemu-id={NEMU_IDS.slaClaim.approve}>
          Setujui klaim
        </Button>
      )}
      {task.status !== "SELESAI" && task.name !== "Persetujuan" && (
        <Button onClick={onAdvance} disabled={advancing} data-nemu-id={NEMU_IDS.slaClaim.submit}>
          {advancing
            ? "Memproses…"
            : task.name === "Surat Penolakan"
              ? "Kirim penolakan"
              : "Kirim dan lanjutkan"}
        </Button>
      )}
    </>
  );
}
