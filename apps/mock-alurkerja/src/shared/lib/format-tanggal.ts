const dateFormatter = new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeZone: "UTC" });

/** A YYYY-MM-DD date as Indonesians read it, e.g. 5 November 2026. */
export function formatTanggal(isoDate: string): string {
  return dateFormatter.format(new Date(`${isoDate}T00:00:00Z`));
}
