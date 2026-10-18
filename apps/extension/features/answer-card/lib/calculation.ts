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

/** Results the user types into a form field as an amount, such as the Momen 2 lodging lumpsum. */
const AMOUNTS: ReadonlySet<Calculation["fungsi"]> = new Set([
  "hitung_lumpsum_penginapan",
  "uang_harian",
  "lookup_sbm",
]);

export type CopyableValue = {
  /** As the card shows it: "Rp447.000". */
  label: string;
  /** As the form field takes it, digits only: "447000". */
  text: string;
};

/** The first amount the answer computed, for the Salin nilai strip. */
export function copyableValue(calculations: readonly Calculation[]): CopyableValue | undefined {
  const entry = calculations.find(
    ({ fungsi, hasil }) => AMOUNTS.has(fungsi) && typeof hasil === "number",
  );
  return typeof entry?.hasil === "number"
    ? { label: formatRupiah(entry.hasil), text: String(entry.hasil) }
    : undefined;
}
