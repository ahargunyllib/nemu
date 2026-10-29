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
import { Field, FieldDescription, FieldLabel } from "@nemu/ui/components/field";
import { Input } from "@nemu/ui/components/input";
import { Spinner } from "@nemu/ui/components/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@nemu/ui/components/table";
import { Textarea } from "@nemu/ui/components/textarea";
import { cn } from "@nemu/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import { CheckIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import SlaClaimTaskHeader from "@/features/sla-claims/components/sla-claim-task-header";

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
        <Link
          to="/crm/$serviceId"
          params={{ serviceId: detail.claim.serviceId }}
          data-nemu-id={NEMU_IDS.slaClaim.crmService}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          Buka CRM Layanan
        </Link>
      </CardContent>
    </Card>
  );
}

function TicketReview({ detail }: { detail: SlaClaimDetail }) {
  const [rcaRequested, setRcaRequested] = useState(false);
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
                        disabled={rcaRequested}
                        data-nemu-id={NEMU_IDS.slaClaim.requestRcaInc2609058}
                        onClick={() => {
                          setRcaRequested(true);
                          toast.success(`Permintaan RCA ${ticket.id} dikirim ke NOC`);
                        }}
                      >
                        {rcaRequested ? "RCA diminta" : "Minta RCA"}
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
          </Field>
        )}
      </CardContent>
    </Card>
  );
}

/** TPL-BILL-02, the late-claim rejection letter, filled in with the claim's values. */
function rejectionLetter({ claim }: SlaClaimDetail): string {
  const period = new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(new Date(`${claim.period}-01T00:00:00+07:00`));
  return [
    `Nomor: TOL-SLA/${claim.id}`,
    "",
    `Kepada ${claim.customer},`,
    "",
    `Terima kasih atas surat klaim nomor ${claim.letterNumber} untuk layanan ${claim.serviceId} periode ${period}. Surat tersebut kami terima pada ${formatDate(claim.receivedAt)}, melewati batas pengajuan tanggal 15 bulan berikutnya sesuai Pasal 5 perjanjian layanan. Karena itu klaim belum dapat kami proses.`,
    "",
    "Hormat kami,",
    "Supervisor Billing",
  ].join("\n");
}

function Rejection({ detail }: { detail: SlaClaimDetail }) {
  const [letter, setLetter] = useState(() => rejectionLetter(detail));
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
        <Field>
          <FieldLabel htmlFor="rejection-letter">Surat penolakan</FieldLabel>
          <Textarea
            id="rejection-letter"
            rows={10}
            value={letter}
            onChange={(event) => setLetter(event.target.value)}
            data-nemu-id={NEMU_IDS.slaClaim.rejectionTemplate}
          />
          <FieldDescription>Dari template TPL-BILL-02.</FieldDescription>
        </Field>
      </CardContent>
    </Card>
  );
}

/**
 * A claim Task in its sheet: the orange header with Delegate and Complete Task (or the disabled
 * approval on Persetujuan), then the stage's fields.
 */
export default function SlaClaimTask({
  detail,
  assignee,
  onAdvance,
  advancing = false,
}: {
  detail: SlaClaimDetail;
  assignee: string;
  onAdvance?: () => void;
  advancing?: boolean;
}) {
  const { task } = detail;
  const showCalculation = ["Susun Berita Acara", "Persetujuan", "Credit Note"].includes(task.name);
  return (
    <>
      <SlaClaimTaskHeader detail={detail} assignee={assignee}>
        <Button
          variant="outline"
          disabled
          className="border-task-header-foreground/80 bg-transparent text-task-header-foreground"
        >
          Delegate
        </Button>
        {task.status === "SELESAI" ? (
          <span
            className={cn(buttonVariants({ variant: "outline" }), "bg-background text-foreground")}
          >
            Completed
            <CheckIcon data-icon="inline-end" />
          </span>
        ) : task.name === "Persetujuan" ? (
          // The Billing Liaison drafted this claim, so only the approvers may approve it.
          <Button
            variant="outline"
            disabled
            data-nemu-id={NEMU_IDS.slaClaim.approve}
            className="bg-background text-foreground"
          >
            Setujui klaim
          </Button>
        ) : (
          <Button
            variant="outline"
            onClick={onAdvance}
            disabled={advancing}
            data-nemu-id={NEMU_IDS.slaClaim.submit}
            className="bg-background text-foreground hover:bg-muted"
          >
            {advancing && <Spinner />}
            Complete Task
          </Button>
        )}
      </SlaClaimTaskHeader>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-4">
        {task.name === "Registrasi Klaim" && <Registration detail={detail} />}
        {task.name === "Cocokkan Layanan & Kontrak" && <ServiceMatch detail={detail} />}
        {task.name === "Telaah Tiket Gangguan" && <TicketReview detail={detail} />}
        {showCalculation && <Calculation detail={detail} />}
        {task.name === "Surat Penolakan" && <Rejection detail={detail} />}
      </div>
    </>
  );
}
