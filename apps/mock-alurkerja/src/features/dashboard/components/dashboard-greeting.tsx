import { Skeleton } from "@nemu/ui/components/skeleton";
import { useQuery } from "@tanstack/react-query";

import { orpc } from "@/shared/api/orpc";

const kickerDate = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/** "My dashboard" on the demo clock's day (NEMU_DEMO_DATE), the same date the AI counts from. */
export default function DashboardGreeting({ name }: { name: string }) {
  const { data: clock } = useQuery(orpc.getDemoClock.queryOptions({ staleTime: Infinity }));
  const firstName = name.split(/\s+/)[0];

  return (
    <div className="space-y-1">
      {clock ? (
        <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          My dashboard · {kickerDate.format(new Date(`${clock.today}T00:00:00Z`)).replace(",", "")}
        </p>
      ) : (
        <Skeleton className="h-4 w-56" />
      )}
      <h1 className="font-heading text-2xl font-semibold">Good morning, {firstName}.</h1>
    </div>
  );
}
