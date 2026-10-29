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
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from "@nemu/ui/components/field";
import { Input } from "@nemu/ui/components/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@nemu/ui/components/input-group";
import { RadioGroup, RadioGroupItem } from "@nemu/ui/components/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@nemu/ui/components/select";
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
import { ToggleGroup, ToggleGroupItem } from "@nemu/ui/components/toggle-group";
import { cn } from "@nemu/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import { ArrowRightIcon, CheckIcon } from "lucide-react";
import { Fragment, useState } from "react";
import { toast } from "sonner";

import SlaClaimTaskHeader from "@/features/sla-claims/components/sla-claim-task-header";
import { CRM_SERVICES, formatSla } from "@/features/sla-claims/lib/crm-records";
import { mergedMinutes } from "@/features/sla-claims/lib/intervals";

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
  /** The Task's assignee, who drafted the claim. */
  assignee: string;
  /** Whether the signed-in user may complete this stage: only the assignee, never at Persetujuan. */
  canAdvance: boolean;
  /** Whether it is the signed-in user's turn on the approval route at Persetujuan. */
  canApprove: boolean;
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

const DECISION_NEMU_ID: Record<string, string> = {
  "INC-2609-014": NEMU_IDS.slaClaim.decisionInc2609014,
  "INC-2609-015": NEMU_IDS.slaClaim.decisionInc2609015,
  "INC-2609-031": NEMU_IDS.slaClaim.decisionInc2609031,
  "INC-2609-047": NEMU_IDS.slaClaim.decisionInc2609047,
  "INC-2609-058": NEMU_IDS.slaClaim.decisionInc2609058,
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

/** "2026-09" as AlurKerja writes a period: "September 2026". */
function formatPeriod(period: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(new Date(`${period}-01T00:00:00+07:00`));
}

const SERVICE_OPTIONS = Object.entries(CRM_SERVICES).map(([id, service]) => ({
  value: id,
  label: `${id} · ${service.location}`,
}));

/**
 * The letter's fields come filled in from the claim: its number, service, period, and claimed
 * hours. Tanggal klaim diterima starts empty, because it is the date the letter reached the billing
 * email, which Nemu fills with Isi; the user answers Diajukan tepat waktu? and attaches the letter.
 */
function Registration({ detail }: { detail: SlaClaimDetail }) {
  const { claim } = detail;
  const [serviceId, setServiceId] = useState(claim.serviceId);
  const [receivedOn, setReceivedOn] = useState("");
  const [timely, setTimely] = useState<string | null>(null);
  const [letterFile, setLetterFile] = useState<string>();
  return (
    <FieldGroup>
      <Field>
        <FieldLabel htmlFor="claim-letter">Nomor surat pelanggan</FieldLabel>
        <Input
          id="claim-letter"
          value={claim.letterNumber}
          readOnly
          data-nemu-id={NEMU_IDS.slaClaim.letterNumber}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="claim-service">Service ID</FieldLabel>
        <Select
          items={SERVICE_OPTIONS}
          value={serviceId}
          onValueChange={(next) => next && setServiceId(next)}
        >
          <SelectTrigger
            id="claim-service"
            className="w-full"
            data-nemu-id={NEMU_IDS.slaClaim.serviceId}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SERVICE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field>
        <FieldLabel htmlFor="claim-period">Periode gangguan</FieldLabel>
        <Input
          id="claim-period"
          value={formatPeriod(claim.period)}
          readOnly
          data-nemu-id={NEMU_IDS.slaClaim.period}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="claim-received">Tanggal klaim diterima</FieldLabel>
        <Input
          id="claim-received"
          placeholder="dd/mm/yyyy"
          value={receivedOn}
          onChange={(event) => setReceivedOn(event.target.value)}
          data-nemu-id={NEMU_IDS.slaClaim.receivedAt}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="claim-hours">Jam gangguan diklaim pelanggan</FieldLabel>
        <Input
          id="claim-hours"
          value={`${hours(claim.claimedMinutes)} jam (sesuai surat)`}
          readOnly
          data-nemu-id={NEMU_IDS.slaClaim.claimedHours}
        />
      </Field>
      <FieldSet>
        <FieldLegend variant="label">Diajukan tepat waktu?</FieldLegend>
        <RadioGroup value={timely} onValueChange={setTimely} className="grid-cols-2">
          <FieldLabel htmlFor="claim-timely-yes" data-nemu-id={NEMU_IDS.slaClaim.timelyYes}>
            <Field orientation="horizontal">
              <RadioGroupItem value="ya" id="claim-timely-yes" />
              <FieldTitle>Ya</FieldTitle>
            </Field>
          </FieldLabel>
          <FieldLabel htmlFor="claim-timely-no" data-nemu-id={NEMU_IDS.slaClaim.timelyNo}>
            <Field orientation="horizontal">
              <RadioGroupItem value="tidak" id="claim-timely-no" />
              <FieldTitle>Tidak</FieldTitle>
            </Field>
          </FieldLabel>
        </RadioGroup>
      </FieldSet>
      <Field>
        <FieldLabel htmlFor="claim-letter-file">Surat klaim (PDF)</FieldLabel>
        <Input
          id="claim-letter-file"
          type="file"
          accept=".pdf"
          onChange={(event) => setLetterFile(event.target.files?.[0]?.name)}
          data-nemu-id={NEMU_IDS.slaClaim.uploadLetter}
        />
        <FieldDescription>
          {letterFile ?? `Surat ${claim.letterNumber} dari pelanggan`}
        </FieldDescription>
      </Field>
    </FieldGroup>
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

type Decision = "dihitung" | "dikecualikan";

/** A NOC cause code as a phrase: "DAYA_PELANGGAN" → "Daya pelanggan". */
function formatCause(cause: string): string {
  const words = cause.replaceAll("_", " ").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** A ticket's interval in WIB as two lines: "3 Sep" over "08.00–20.00". */
function formatInterval(start: string, end: string): { days: string; times: string } {
  const day = (value: string) =>
    new Intl.DateTimeFormat("id-ID", {
      day: "numeric",
      month: "short",
      timeZone: "Asia/Jakarta",
    }).format(new Date(value));
  const time = (value: string) => value.slice(11, 16).replace(":", ".");
  return {
    days: day(start) === day(end) ? day(start) : `${day(start)} – ${day(end)}`,
    times: `${time(start)}–${time(end)}`,
  };
}

/**
 * Each ticket gets a Keputusan: Dihitung, or Dikecualikan for an outage on the customer's side.
 * Gabungkan interval then adds up the counted tickets with overlaps counted once, which gives A.
 */
function TicketReview({ detail }: { detail: SlaClaimDetail }) {
  const { claim, context, summary } = detail;
  const [rcaRequested, setRcaRequested] = useState(false);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [countedMinutes, setCountedMinutes] = useState<number | null>(null);

  function decide(ticketId: string, decision: Decision | undefined) {
    setDecisions((current) => {
      const { [ticketId]: _previous, ...rest } = current;
      return decision ? { ...rest, [ticketId]: decision } : rest;
    });
    setCountedMinutes(null);
  }

  function mergeIntervals() {
    setCountedMinutes(
      mergedMinutes(context.tickets.filter((ticket) => decisions[ticket.id] === "dihitung")),
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <h3 className="font-medium">
          Tiket NOC · {claim.serviceId} · {formatPeriod(claim.period)}
        </h3>
        <Button
          size="sm"
          variant="outline"
          onClick={mergeIntervals}
          data-nemu-id={NEMU_IDS.slaClaim.mergeIntervals}
        >
          Gabungkan interval
        </Button>
      </div>
      {/* Six columns fit the sheet only with tighter cells than the stock table's. */}
      <Table className="[&_td]:px-1.5 [&_th]:px-1.5 [&_th]:whitespace-normal">
        <TableHeader>
          <TableRow>
            <TableHead>Tiket</TableHead>
            <TableHead>Interval (WIB)</TableHead>
            <TableHead>Jam</TableHead>
            <TableHead>Penyebab</TableHead>
            <TableHead>RCA</TableHead>
            <TableHead>Keputusan</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {context.tickets.map((ticket) => {
            const missing = summary.missingTicketIds.includes(ticket.id);
            const minutes = (Date.parse(ticket.end) - Date.parse(ticket.start)) / 60_000;
            const decision = decisions[ticket.id];
            const interval = formatInterval(ticket.start, ticket.end);
            return (
              <TableRow key={ticket.id} data-nemu-id={TICKET_NEMU_ID[ticket.id]}>
                <TableCell className="font-medium">{ticket.id}</TableCell>
                <TableCell>
                  <div>{interval.days}</div>
                  <div className="text-muted-foreground">{interval.times}</div>
                </TableCell>
                <TableCell>{hours(minutes)}j</TableCell>
                <TableCell className="whitespace-normal">{formatCause(ticket.cause)}</TableCell>
                <TableCell>
                  <div className="flex flex-col items-start gap-1">
                    {ticket.rcaId && <span>{ticket.rcaId}</span>}
                    <Badge variant={missing ? "destructive" : "secondary"}>
                      {ticket.rcaStatus}
                    </Badge>
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
                  </div>
                </TableCell>
                <TableCell>
                  <ToggleGroup
                    variant="outline"
                    size="sm"
                    spacing={0}
                    value={decision ? [decision] : []}
                    onValueChange={(next) => decide(ticket.id, next[0] as Decision | undefined)}
                    disabled={missing}
                    aria-label={`Keputusan ${ticket.id}`}
                    data-nemu-id={DECISION_NEMU_ID[ticket.id]}
                  >
                    <ToggleGroupItem value="dihitung">Dihitung</ToggleGroupItem>
                    <ToggleGroupItem value="dikecualikan">Dikecualikan</ToggleGroupItem>
                  </ToggleGroup>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <dl className="grid grid-cols-2 gap-4 rounded-2xl bg-muted p-4">
        <div>
          <dt className="text-muted-foreground">Durasi dihitung (A)</dt>
          <dd className="text-lg font-medium">
            {countedMinutes === null ? "–" : `${hours(countedMinutes)} jam`}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Diklaim pelanggan</dt>
          <dd className="text-lg font-medium">{hours(claim.claimedMinutes)} jam</dd>
        </div>
      </dl>
      {summary.missingTicketIds.length > 0 && (
        <p className="text-destructive">
          Nominal belum dapat ditetapkan sampai RCA {summary.missingTicketIds.join(", ")} disahkan.
        </p>
      )}
    </div>
  );
}

/** "Sari Wulandari (Supervisor Billing)" as MP-BILL-02 names an approver, split for the route. */
function approverParts(approver: string): { name: string; role: string } {
  const match = approver.match(/^(.+?) \((.+)\)$/u);
  return match
    ? { name: match[1] ?? approver, role: match[2] ?? "" }
    : { name: approver, role: "" };
}

/** TPL-BILL-01, the berita acara, filled in with the claim's values and the amount typed. */
function minutesDraft(detail: SlaClaimDetail, amount: string): string {
  const { claim, context, summary } = detail;
  const counted = context.tickets
    .filter(
      (ticket) =>
        !summary.excludedTicketIds.includes(ticket.id) &&
        !summary.missingTicketIds.includes(ticket.id),
    )
    .map((ticket) => `${ticket.id} (${ticket.rcaId})`);
  const excluded = context.tickets
    .filter((ticket) => summary.excludedTicketIds.includes(ticket.id))
    .map((ticket) => `${ticket.id} (${ticket.rcaId}, ${formatCause(ticket.cause).toLowerCase()})`);
  const basis = context.service.addendumId
    ? `kontrak ${context.service.contractId} dan adendum ${context.service.addendumId}`
    : `kontrak ${context.service.contractId}`;
  return [
    `Nomor: BA-SLA/${claim.id}`,
    "",
    `1. Identitas klaim: ${claim.id}, surat ${claim.letterNumber}, ${claim.customer}, ${claim.serviceId}, ${formatPeriod(claim.period)}.`,
    `2. Dasar: ${basis}. SLA berlaku ${formatSla(context.service.effectiveSlaBasisPoints)}.`,
    `3. Tiket dihitung: ${counted.join(", ") || "tidak ada"}.`,
    `4. Tiket dikecualikan: ${excluded.join(", ") || "tidak ada"}.`,
    `5. Rincian hitung: C = ${hours(summary.totalPeriodMinutes)} jam, Av = ${hours(summary.allowedDowntimeMinutes)} jam, A = ${hours(summary.actualDowntimeMinutes)} jam, B = Rp${context.invoice.monthlyFeeIdr.toLocaleString("id-ID")}.`,
    `6. Nominal usulan: Rp${Number(amount).toLocaleString("id-ID")}.`,
    `7. Pembanding: jam diklaim pelanggan ${hours(claim.claimedMinutes)} jam.`,
    `8. Penelaah: ${detail.assignee}.`,
    `9. Rute persetujuan: ${summary.approvers.join(", ")}.`,
  ].join("\n");
}

function CalculationTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border p-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

/**
 * Susun Berita Acara: Hitung fills in the computed terms of the formula, but never the amount,
 * which Nemu offers to fill with Isi. The route says who approves it; the draft quotes the amount.
 */
function Calculation({ detail }: { detail: SlaClaimDetail }) {
  const { summary } = detail;
  const [calculated, setCalculated] = useState(detail.task.name !== "Susun Berita Acara");
  const [compensationAmount, setCompensationAmount] = useState("");
  const [draft, setDraft] = useState("");
  const computed = (value: string) => (calculated ? value : "–");
  const route = summary.approvers.map(approverParts);
  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <h3 className="font-medium">Rincian hitung</h3>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setCalculated(true)}
            data-nemu-id={NEMU_IDS.slaClaim.calculate}
          >
            Hitung
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <CalculationTile
            label="C · jam bulan"
            value={computed(hours(summary.totalPeriodMinutes))}
          />
          <CalculationTile
            label="SLA berlaku"
            value={formatSla(detail.context.service.effectiveSlaBasisPoints)}
          />
          <CalculationTile
            label="Av · toleransi"
            value={computed(`${hours(summary.allowedDowntimeMinutes)} jam`)}
          />
          <CalculationTile
            label="A · dihitung"
            value={computed(`${hours(summary.actualDowntimeMinutes)} jam`)}
          />
          <CalculationTile
            label="B · abonemen"
            value={`Rp${detail.context.invoice.monthlyFeeIdr.toLocaleString("id-ID")}`}
          />
        </div>
      </section>
      {summary.compensationAmount === null ? (
        <p className="text-destructive">
          Nominal belum dapat ditetapkan karena bukti RCA belum lengkap.
        </p>
      ) : (
        <>
          <Field>
            <FieldLabel htmlFor="compensation">Nominal usulan</FieldLabel>
            <InputGroup>
              <InputGroupAddon>
                <InputGroupText>Rp</InputGroupText>
              </InputGroupAddon>
              <InputGroupInput
                id="compensation"
                type="number"
                value={compensationAmount}
                onChange={(event) => setCompensationAmount(event.target.value)}
                data-nemu-id={NEMU_IDS.slaClaim.compensationAmount}
              />
            </InputGroup>
          </Field>
          <section className="flex flex-col gap-3">
            <h3 className="font-medium">Rute persetujuan</h3>
            <div className="flex flex-wrap items-center gap-3">
              {route.map((approver, index) => (
                <Fragment key={approver.name}>
                  {index > 0 && <ArrowRightIcon className="text-muted-foreground" />}
                  <div className="flex flex-col rounded-2xl border px-4 py-2">
                    <span className="font-medium">{approver.name}</span>
                    <span className="text-muted-foreground">{approver.role}</span>
                  </div>
                </Fragment>
              ))}
              {/* MP-BILL-02 adds the Manajer Billing Operations above Rp500.000. */}
              {route.length > 1 && <Badge variant="secondary">Di atas Rp500.000</Badge>}
            </div>
          </section>
          <Field>
            <div className="flex items-center justify-between gap-4">
              <FieldLabel htmlFor="minutes-draft">Draft berita acara</FieldLabel>
              <Button
                size="sm"
                variant="outline"
                disabled={!compensationAmount}
                onClick={() => setDraft(minutesDraft(detail, compensationAmount))}
                data-nemu-id={NEMU_IDS.slaClaim.draftMinutes}
              >
                Buat draft berita acara
              </Button>
            </div>
            <Textarea
              id="minutes-draft"
              rows={8}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Tekan 'Buat draft berita acara' setelah nominal terisi"
            />
          </Field>
        </>
      )}
    </div>
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

function CreditNote({ detail }: { detail: SlaClaimDetail }) {
  const { claim, summary } = detail;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Credit note</CardTitle>
        <CardDescription>
          Diterbitkan Billing Finance setelah semua persetujuan lengkap.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2">
          <dt className="text-muted-foreground">Nominal disetujui</dt>
          <dd>Rp{summary.compensationAmount?.toLocaleString("id-ID")}</dd>
          <dt className="text-muted-foreground">Disetujui oleh</dt>
          <dd>{summary.approvers.join(", ")}</dd>
          <dt className="text-muted-foreground">Dipotong dari</dt>
          <dd>Invoice bulan berikutnya untuk {claim.serviceId}</dd>
        </dl>
      </CardContent>
    </Card>
  );
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
 * A claim Task in its sheet: the orange header with Delegasikan and Selesaikan Tugas (or Setujui
 * klaim on Persetujuan, enabled only for the approver whose turn it is), then the stage's fields.
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
          Delegasikan
        </Button>
        {task.status === "SELESAI" ? (
          <span
            className={cn(buttonVariants({ variant: "outline" }), "bg-background text-foreground")}
          >
            Selesai
            <CheckIcon data-icon="inline-end" />
          </span>
        ) : task.name === "Persetujuan" ? (
          // The Billing Liaison drafted this claim, so only the approvers may approve it.
          <Button
            variant="outline"
            onClick={onAdvance}
            disabled={!detail.canApprove || advancing}
            data-nemu-id={NEMU_IDS.slaClaim.approve}
            className="bg-background text-foreground hover:bg-muted"
          >
            {advancing && <Spinner />}
            Setujui klaim
          </Button>
        ) : (
          <Button
            variant="outline"
            onClick={onAdvance}
            disabled={!detail.canAdvance || advancing}
            data-nemu-id={NEMU_IDS.slaClaim.submit}
            className="bg-background text-foreground hover:bg-muted"
          >
            {advancing && <Spinner />}
            Selesaikan Tugas
          </Button>
        )}
      </SlaClaimTaskHeader>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-4">
        {task.name === "Registrasi Klaim" && <Registration detail={detail} />}
        {task.name === "Cocokkan Layanan & Kontrak" && <ServiceMatch detail={detail} />}
        {task.name === "Telaah Tiket Gangguan" && <TicketReview detail={detail} />}
        {showCalculation && <Calculation detail={detail} />}
        {task.name === "Credit Note" && <CreditNote detail={detail} />}
        {task.name === "Surat Penolakan" && <Rejection detail={detail} />}
      </div>
    </>
  );
}
