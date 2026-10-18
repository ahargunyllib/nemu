import type { ProcessInstanceView } from "@/features/perjalanan-dinas/types/process-instance-view";

const DAY_MS = 24 * 60 * 60 * 1000;
/** Days a Task has before it falls due. The demo keeps no due date, so every Task gets a week. */
const TASK_DUE_DAYS = 7;
// The demo's Satker is in Yogyakarta, so Task days turn over at midnight WIB wherever the demo runs.
const wibDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" });

/**
 * When a Task falls due: a week after it opened. A Task opens when its State last changed, so
 * `updatedAt` stands in for when it was created.
 */
export function taskDueDate(instance: Pick<ProcessInstanceView, "updatedAt">): Date {
  return new Date(instance.updatedAt.getTime() + TASK_DUE_DAYS * DAY_MS);
}

/** Whole WIB days from `now` to `due`: 0 on the due day, negative once the Task is late. */
export function daysUntilDue(due: Date, now: Date): number {
  const day = (date: Date) => Date.parse(`${wibDay.format(date)}T00:00:00Z`);
  return Math.round((day(due) - day(now)) / DAY_MS);
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
