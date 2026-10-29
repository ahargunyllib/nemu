import { Badge } from "@nemu/ui/components/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@nemu/ui/components/card";
import { Skeleton } from "@nemu/ui/components/skeleton";
import { useQuery } from "@tanstack/react-query";

import { MY_PERFORMANCE, MY_PERFORMANCE_DAYS } from "@/features/dashboard/lib/my-performance";
import { orpc } from "@/shared/api/orpc";

const rangeDate = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/** The user's last 30 days, counted back from the demo clock's day. */
export default function MyPerformanceCard() {
  const { data: clock } = useQuery(orpc.getDemoClock.queryOptions({ staleTime: Infinity }));

  return (
    <Card size="sm">
      <CardHeader className="gap-3">
        <CardTitle>Kinerja Saya</CardTitle>
        {clock ? (
          <Badge variant="outline" className="h-7 w-full justify-start px-3 font-normal">
            {performanceRange(clock.today)}
          </Badge>
        ) : (
          <Skeleton className="h-7 w-full rounded-4xl" />
        )}
      </CardHeader>
      <CardContent>
        <dl className="divide-y">
          {MY_PERFORMANCE.map((stat) => (
            <div key={stat.label} className="flex items-baseline justify-between gap-4 py-2.5">
              <dt className="text-xs text-muted-foreground">{stat.label}</dt>
              <dd className="text-right text-xs font-medium">{stat.value}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}

function performanceRange(today: string): string {
  const end = new Date(`${today}T00:00:00Z`);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - MY_PERFORMANCE_DAYS);
  return `${rangeDate.format(start)} – ${rangeDate.format(end)}`;
}
