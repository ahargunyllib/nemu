/** The six stages of a Klaim Kompensasi SLA, in order. A late claim leaves them for Surat Penolakan. */
export const CLAIM_STAGES = [
  "Registrasi Klaim",
  "Cocokkan Layanan & Kontrak",
  "Telaah Tiket Gangguan",
  "Susun Berita Acara",
  "Persetujuan",
  "Credit Note",
] as const;

/** "Tahap 1 dari 6" for a stage Task, or null for one outside the stages (Surat Penolakan). */
export function stageLabel(taskName: string): string | null {
  const index = CLAIM_STAGES.findIndex((stage) => stage === taskName);
  return index < 0 ? null : `Tahap ${index + 1} dari ${CLAIM_STAGES.length}`;
}

const shortDate = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Jakarta",
});

const shortMonth = new Intl.DateTimeFormat("id-ID", {
  month: "short",
  year: "numeric",
  timeZone: "Asia/Jakarta",
});

/** A claim day as the task sheet shows it: "8 Okt 2026". Takes a date or a timestamp. */
export function formatClaimDay(value: string): string {
  return shortDate.format(new Date(`${value.slice(0, 10)}T00:00:00+07:00`));
}

/** A claim period ("2026-09") as the task list shows it: "Sep 2026". */
export function formatClaimPeriod(period: string): string {
  return shortMonth.format(new Date(`${period}-01T00:00:00+07:00`));
}
