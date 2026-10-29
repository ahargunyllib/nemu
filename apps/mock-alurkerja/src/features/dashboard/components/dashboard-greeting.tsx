import { Skeleton } from "@nemu/ui/components/skeleton";
import { PageHeading } from "@nemu/ui/shell/page-heading";
import { useQuery } from "@tanstack/react-query";

import { orpc } from "@/shared/api/orpc";

const kickerDate = new Intl.DateTimeFormat("id-ID", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

/** "Dasbor saya" on the demo clock's day (NEMU_DEMO_DATE), the same date the AI counts from. */
export default function DashboardGreeting({ name }: { name: string }) {
  const { data: clock } = useQuery(orpc.getDemoClock.queryOptions({ staleTime: Infinity }));
  const firstName = name.split(/\s+/)[0];

  return (
    <PageHeading
      kicker={
        clock ? (
          `Dasbor saya · ${kickerDate.format(new Date(`${clock.today}T00:00:00Z`))}`
        ) : (
          <Skeleton className="h-4 w-56" />
        )
      }
      title={`Selamat pagi, ${firstName}.`}
    />
  );
}
