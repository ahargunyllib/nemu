import { Badge } from "@nemu/ui/components/badge";
import { Skeleton } from "@nemu/ui/components/skeleton";
import { useQuery } from "@tanstack/react-query";

import { formatTanggal } from "@/shared/lib/format-tanggal";
import { orpc } from "@/shared/api/orpc";

/** "Today" from the demo clock (NEMU_DEMO_DATE), the same date the AI counts from. */
export default function DemoToday() {
  const { data: clock } = useQuery(orpc.getDemoClock.queryOptions({ staleTime: Infinity }));

  if (!clock) return <Skeleton className="h-5 w-40" />;
  return <Badge variant="outline">Hari ini {formatTanggal(clock.today)}</Badge>;
}
