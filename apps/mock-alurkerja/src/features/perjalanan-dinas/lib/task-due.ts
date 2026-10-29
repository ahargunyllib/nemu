const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * A YYYY-MM-DD day as a Date at midnight UTC; format it with `timeZone: "UTC"` to read the same day.
 * The Nemu Service sends Task dates as days on the demo clock (NEMU_DEMO_DATE), the days the AI
 * counts from.
 */
export function dayToDate(day: string): Date {
  return new Date(`${day}T00:00:00Z`);
}

/** Whole days from `today` to `day` (both YYYY-MM-DD): 0 on the day, negative once it has passed. */
export function daysUntil(day: string, today: string): number {
  return Math.round((dayToDate(day).getTime() - dayToDate(today).getTime()) / DAY_MS);
}

export const DUE_FILTERS = ["Overdue", "Due Today", "Upcoming", "All Tasks"] as const;

export type DueFilter = (typeof DUE_FILTERS)[number];

/** Whether a Task `daysLeft` from its due day falls under `filter`. */
export function matchesDueFilter(filter: DueFilter, daysLeft: number): boolean {
  if (filter === "Overdue") return daysLeft < 0;
  if (filter === "Due Today") return daysLeft === 0;
  if (filter === "Upcoming") return daysLeft > 0;
  return true;
}
