/**
 * Minutes the intervals cover together, counting an overlap once, as Gabungkan interval does on
 * Telaah Tiket Gangguan (SOP-KLAIM-SLA-01 Pasal 5 ayat (2)): two reports of one outage add up to
 * the outage, not to their sum.
 */
export function mergedMinutes(intervals: readonly { start: string; end: string }[]): number {
  const sorted = intervals
    .map(({ start, end }) => [Date.parse(start), Date.parse(end)] as const)
    .sort(([a], [b]) => a - b);
  let total = 0;
  let current: [number, number] | undefined;
  for (const [start, end] of sorted) {
    if (current && start <= current[1]) {
      current[1] = Math.max(current[1], end);
      continue;
    }
    if (current) total += current[1] - current[0];
    current = [start, end];
  }
  if (current) total += current[1] - current[0];
  return total / 60_000;
}
