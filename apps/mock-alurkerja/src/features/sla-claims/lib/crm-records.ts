/**
 * What CRM Layanan shows about the W-TELKO services, contracts, and addenda beyond the claim API,
 * which carries only their ids, the monthly fee, and the effective SLA. Copied from the seeded
 * `telco_service` rows and the KON-2026-01 and ADD-2026-02 documents, plus the draft ADD-2026-03,
 * which CRM lists but which was never signed, so it has no document and changes nothing.
 */
export const CRM_SERVICES: Readonly<
  Record<string, { location: string; product: string; bandwidthMbps: number }>
> = {
  "TN-ENT-001": {
    location: "Kantor pusat, Jakarta Selatan",
    product: "Internet Dedicated",
    bandwidthMbps: 100,
  },
  "TN-ENT-002": {
    location: "Gudang distribusi, Cikarang",
    product: "Internet Dedicated",
    bandwidthMbps: 100,
  },
  "TN-ENT-003": {
    location: "Toko flagship, Bandung",
    product: "Internet Dedicated",
    bandwidthMbps: 50,
  },
};

export const CRM_CONTRACTS: Readonly<
  Record<string, { status: string; validity: string; slaBasisPoints: number; formula: string }>
> = {
  "KON-2026-01": {
    status: "Disahkan",
    validity: "1 Sep 2026 – 31 Agu 2027",
    slaBasisPoints: 9_900,
    formula: "min(B, max(0, (A − Av) / C × B))",
  },
};

export type CrmAddendum = {
  status: string;
  /** What the addendum changes, as CRM sums it up. */
  subject: string;
  serviceId: string;
} & ({ signed: true; effectiveOn: string; replaces: string } | { signed: false });

export const CRM_ADDENDA: Readonly<Record<string, CrmAddendum>> = {
  "ADD-2026-02": {
    status: "Disahkan",
    subject: "Ubah SLA",
    serviceId: "TN-ENT-002",
    signed: true,
    effectiveOn: "1 Sep 2026",
    replaces: "KON-2026-01 Pasal 4.1",
  },
  "ADD-2026-03": {
    status: "Rancangan",
    subject: "Ubah jam pemeliharaan",
    serviceId: "TN-ENT-002",
    signed: false,
  },
};

/** An SLA in basis points as CRM Layanan writes it: 9950 → "99,50%". */
export function formatSla(basisPoints: number): string {
  return `${(basisPoints / 100).toLocaleString("id-ID", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;
}
