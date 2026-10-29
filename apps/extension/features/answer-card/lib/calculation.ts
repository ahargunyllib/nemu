import type { Calculation } from "@nemu/contracts";

type CalculationValue = Calculation["hasil"];

export type CalculationLine = {
  title: string;
  formula: string;
  result: string;
  source?: string;
};

const TITLES: Record<Calculation["fungsi"], string> = {
  lookup_sbm: "Tarif SBM",
  hitung_lumpsum_penginapan: "Lumpsum penginapan",
  uang_harian: "Uang harian",
  batas_pertanggungjawaban: "Batas Pertanggungjawaban",
  sisa_hari_kerja: "Sisa hari kerja",
  claim_cutoff: "Batas pengajuan klaim",
  merge_claim_intervals: "Durasi gangguan tergabung",
  sla_compensation: "Kompensasi SLA",
  claim_approval_route: "Rute persetujuan",
  claim_evidence_guard: "Kelengkapan bukti RCA",
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function formatRupiah(amount: number): string {
  return `Rp${new Intl.NumberFormat("id-ID").format(amount)}`;
}

export function formatDate(isoDate: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${isoDate}T00:00:00Z`));
}

function formatValue(value: CalculationValue): string {
  if (value === null) return "–";
  if (typeof value === "number") return new Intl.NumberFormat("id-ID").format(value);
  if (typeof value === "string" && ISO_DATE.test(value)) return formatDate(value);
  return String(value);
}

function describeFormula(calculation: Calculation): Pick<CalculationLine, "formula" | "result"> {
  const { input, hasil } = calculation;

  if (calculation.fungsi === "hitung_lumpsum_penginapan") {
    const { persentase, tarif, malam } = input;
    if (
      typeof persentase === "number" &&
      typeof tarif === "number" &&
      typeof malam === "number" &&
      typeof hasil === "number"
    ) {
      return {
        formula: `${persentase}% × ${formatRupiah(tarif)} × ${malam} malam`,
        result: formatRupiah(hasil),
      };
    }
  }

  if (calculation.fungsi === "batas_pertanggungjawaban") {
    const { hari_kerja, tanggal_kembali } = input;
    if (
      typeof hari_kerja === "number" &&
      typeof tanggal_kembali === "string" &&
      ISO_DATE.test(tanggal_kembali) &&
      typeof hasil === "string"
    ) {
      return {
        formula: `${hari_kerja} hari kerja setelah ${formatDate(tanggal_kembali)}`,
        result: formatValue(hasil),
      };
    }
  }

  if (calculation.fungsi === "sla_compensation" && typeof hasil === "number") {
    return {
      formula: Object.entries(input)
        .map(([name, value]) => `${name.replaceAll("_", " ")}: ${formatValue(value)}`)
        .join(", "),
      result: formatRupiah(hasil),
    };
  }

  return {
    formula: Object.entries(input)
      .map(([name, value]) => `${name.replaceAll("_", " ")}: ${formatValue(value)}`)
      .join(", "),
    result: formatValue(hasil),
  };
}

/** Turns a calculation from the Nemu Service into the breakdown the Answer Card shows. */
export function describeCalculation(calculation: Calculation): CalculationLine {
  return {
    title: TITLES[calculation.fungsi],
    ...describeFormula(calculation),
    source: calculation.sumber,
  };
}

/**
 * Results the user types into a form field as an amount, most wanted first, such as the
 * Momen 2 lodging lumpsum ahead of the daily allowance. `lookup_sbm` is a rate the answer
 * computes from, not an amount anyone fills in, so it is never offered.
 */
const AMOUNTS: readonly Calculation["fungsi"][] = ["hitung_lumpsum_penginapan", "uang_harian"];

export type CopyableValue = {
  /** As the card shows it: "Rp447.000". */
  label: string;
  /** As the form field takes it, digits only: "447000". */
  text: string;
};

/** The amount the answer computed for the user to fill in, for the Salin nilai strip. */
export function copyableValue(calculations: readonly Calculation[]): CopyableValue | undefined {
  for (const fungsi of AMOUNTS) {
    const entry = calculations.find((calculation) => calculation.fungsi === fungsi);
    if (typeof entry?.hasil === "number") {
      return { label: formatRupiah(entry.hasil), text: String(entry.hasil) };
    }
  }
  return undefined;
}
