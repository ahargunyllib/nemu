import { NEMU_IDS } from "@nemu/contracts/nemu-ids";
import { Badge } from "@nemu/ui/components/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@nemu/ui/components/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@nemu/ui/components/tabs";
import { useState } from "react";

import {
  CRM_ADDENDA,
  CRM_CONTRACTS,
  CRM_SERVICES,
  formatSla,
} from "@/features/sla-claims/lib/crm-records";

type Tab = "ringkasan" | "kontrak" | "riwayat";

function Facts({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-muted-foreground">{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * A service's CRM Layanan record: Ringkasan, then Kontrak & Adendum with the contract and its
 * signed addendum side by side and any other addenda below. Kontrak & Adendum is a Nemu guide
 * step, so its tab drops `tab-kontrak-adendum` once open: the guide moves on when it is gone.
 */
export default function CrmServiceRecord({
  customer,
  serviceId,
  contractId,
  addendumId,
  effectiveSlaBasisPoints,
  monthlyFeeIdr,
}: {
  customer: string;
  serviceId: string;
  contractId: string;
  addendumId: string | null;
  effectiveSlaBasisPoints: number;
  monthlyFeeIdr: number;
}) {
  const [tab, setTab] = useState<Tab>("ringkasan");
  const service = CRM_SERVICES[serviceId];
  const contract = CRM_CONTRACTS[contractId];
  const addendum = addendumId ? CRM_ADDENDA[addendumId] : undefined;
  const otherAddenda = Object.entries(CRM_ADDENDA).filter(
    ([id, other]) => other.serviceId === serviceId && id !== addendumId,
  );
  const fee = `Rp${monthlyFeeIdr.toLocaleString("id-ID")}`;

  return (
    <Tabs value={tab} onValueChange={(next: Tab) => setTab(next)} className="gap-4">
      <TabsList>
        <TabsTrigger
          value="ringkasan"
          className="px-4"
          data-nemu-id={NEMU_IDS.slaClaim.crmSummaryTab}
        >
          Ringkasan
        </TabsTrigger>
        <TabsTrigger
          value="kontrak"
          className="px-4"
          data-nemu-id={tab === "kontrak" ? undefined : NEMU_IDS.slaClaim.crmContractTab}
        >
          Kontrak &amp; Adendum
        </TabsTrigger>
        {/* AlurKerja shows a service's history here; the demo has none. */}
        <TabsTrigger value="riwayat" disabled className="px-4">
          Riwayat
        </TabsTrigger>
      </TabsList>

      <TabsContent value="ringkasan">
        <Card>
          <CardHeader>
            <CardTitle>Layanan</CardTitle>
            <CardDescription>{customer}</CardDescription>
          </CardHeader>
          <CardContent>
            <Facts
              rows={[
                ["Service ID", serviceId],
                ["Lokasi", service?.location ?? "–"],
                ["Produk", service ? `${service.product} ${service.bandwidthMbps} Mbps` : "–"],
                ["Abonemen sebelum PPN", fee],
                ["Kontrak", contractId],
                ["SLA berlaku", formatSla(effectiveSlaBasisPoints)],
              ]}
            />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="kontrak" className="flex flex-col gap-4">
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Kontrak {contractId}</CardTitle>
              {contract && (
                <CardAction>
                  <Badge variant="secondary">{contract.status}</Badge>
                </CardAction>
              )}
            </CardHeader>
            <CardContent>
              {contract && (
                <Facts
                  rows={[
                    ["Berlaku", contract.validity],
                    ["Abonemen", fee],
                    [
                      "SLA (Pasal 4.1)",
                      addendum ? (
                        <s className="text-muted-foreground">
                          {formatSla(contract.slaBasisPoints)}
                        </s>
                      ) : (
                        formatSla(contract.slaBasisPoints)
                      ),
                    ],
                    ["Formula", <code key="formula">{contract.formula}</code>],
                  ]}
                />
              )}
            </CardContent>
          </Card>
          {addendumId && (
            <Card>
              <CardHeader>
                <CardTitle>Adendum {addendumId}</CardTitle>
                {addendum && (
                  <CardAction>
                    <Badge variant="secondary">{addendum.status}</Badge>
                  </CardAction>
                )}
              </CardHeader>
              <CardContent>
                <Facts
                  rows={[
                    ...(addendum?.signed
                      ? ([
                          ["Efektif", addendum.effectiveOn],
                          ["Mengganti", addendum.replaces],
                          ["Khusus", addendum.serviceId],
                        ] as [string, string][])
                      : []),
                    ["SLA baru", <strong key="sla">{formatSla(effectiveSlaBasisPoints)}</strong>],
                  ]}
                />
              </CardContent>
            </Card>
          )}
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Adendum lain</CardTitle>
            <CardDescription>Adendum yang belum disahkan tidak berlaku.</CardDescription>
          </CardHeader>
          <CardContent>
            {otherAddenda.length === 0 ? (
              <p className="text-muted-foreground">Tidak ada adendum lain untuk {serviceId}.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {otherAddenda.map(([id, other]) => (
                  <li key={id}>
                    {id}{" "}
                    <span className="text-muted-foreground">
                      ({other.status.toLowerCase()}
                      {other.signed ? "" : ", belum disahkan"} · {other.subject.toLowerCase()}
                      {other.signed ? "" : " · tidak berlaku"})
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
