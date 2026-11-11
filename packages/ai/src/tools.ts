import type { Calculation } from "@nemu/contracts";

export type SbmComponent = "hotel" | "uang_harian" | "transport_bandara" | "tiket_pesawat";

export type SbmRow = {
  province: string;
  component: SbmComponent;
  grade: string;
  value: number;
  source: string;
};

export type HotelRateCheck = {
  limit: number;
  rate: number;
  exceeds: boolean;
  difference: number;
};

function normalizeText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLocaleLowerCase("id-ID")
    .replace(/[^a-z0-9]+/gu, " ")
    .trim();
}

export function normalizeDocumentName(value: string): string {
  return normalizeText(value);
}

function normalizeGrade(value: string): string {
  const upperValue = value.toUpperCase();
  const match = upperValue.match(/(?:^|\s)(IV|III|II|I)(?:\s|\/|$)/u);
  return match?.[1] ?? upperValue.trim();
}

export function lookupSbm(
  rows: readonly SbmRow[],
  province: string,
  component: SbmComponent,
  grade: string,
): SbmRow | undefined {
  const normalizedProvince = normalizeText(province);
  const normalizedGrade = normalizeGrade(grade);

  return rows.find(
    (row) =>
      normalizeText(row.province) === normalizedProvince &&
      row.component === component &&
      (row.grade === "*" || normalizeGrade(row.grade) === normalizedGrade),
  );
}

export function calculateAccommodationLumpSum(rate: number, nights: number): Calculation {
  if (!Number.isInteger(rate) || rate < 0) {
    throw new Error("Accommodation rate must be a non-negative integer");
  }
  if (!Number.isInteger(nights) || nights < 0) {
    throw new Error("Number of nights must be a non-negative integer");
  }

  return {
    fungsi: "hitung_lumpsum_penginapan",
    input: { tarif: rate, malam: nights, persentase: 30 },
    hasil: Math.round(rate * 0.3 * nights),
  };
}

export function calculateDailyAllowance(rate: number, days: number): Calculation {
  if (!Number.isInteger(rate) || rate < 0) {
    throw new Error("Daily allowance rate must be a non-negative integer");
  }
  if (!Number.isInteger(days) || days < 0) {
    throw new Error("Number of days must be a non-negative integer");
  }

  return {
    fungsi: "uang_harian",
    input: { tarif: rate, hari: days },
    hasil: rate * days,
  };
}

export function checkHotelRate(limit: number, rate: number): HotelRateCheck {
  if (!Number.isInteger(limit) || limit < 0 || !Number.isInteger(rate) || rate < 0) {
    throw new Error("Hotel limit and rate must be non-negative integers");
  }

  return {
    limit,
    rate,
    exceeds: rate > limit,
    difference: Math.max(0, rate - limit),
  };
}

function parseIsoDate(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) {
    throw new Error(`Invalid ISO date: ${value}`);
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error(`Invalid calendar date: ${value}`);
  }
  return date;
}

function formatIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function isWorkingDay(date: Date, holidays: ReadonlySet<string>): boolean {
  const day = date.getUTCDay();
  return day !== 0 && day !== 6 && !holidays.has(formatIsoDate(date));
}

export function calculateAccountabilityDeadline(
  returnDate: string,
  holidays: readonly string[],
  workingDays = 5,
): Calculation {
  if (!Number.isInteger(workingDays) || workingDays < 1) {
    throw new Error("Working-day limit must be a positive integer");
  }

  const holidaySet = new Set(holidays);
  const cursor = parseIsoDate(returnDate);
  let elapsedWorkingDays = 0;

  while (elapsedWorkingDays < workingDays) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    if (isWorkingDay(cursor, holidaySet)) {
      elapsedWorkingDays += 1;
    }
  }

  return {
    fungsi: "batas_pertanggungjawaban",
    input: { tanggal_kembali: returnDate, hari_kerja: workingDays },
    hasil: formatIsoDate(cursor),
  };
}

export function calculateRemainingWorkingDays(
  currentDate: string,
  deadline: string,
  holidays: readonly string[],
): Calculation {
  const holidaySet = new Set(holidays);
  const cursor = parseIsoDate(currentDate);
  const deadlineDate = parseIsoDate(deadline);
  let remaining = 0;

  while (cursor < deadlineDate) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    if (isWorkingDay(cursor, holidaySet)) {
      remaining += 1;
    }
  }

  return {
    fungsi: "sisa_hari_kerja",
    input: { tanggal_sekarang: currentDate, tenggat: deadline },
    hasil: remaining,
  };
}

export function findMissingDocuments(
  requiredDocuments: readonly string[],
  uploadedDocuments: readonly string[],
): string[] {
  const uploaded = new Set(uploadedDocuments.map(normalizeDocumentName));
  return requiredDocuments.filter((document) => !uploaded.has(normalizeDocumentName(document)));
}
