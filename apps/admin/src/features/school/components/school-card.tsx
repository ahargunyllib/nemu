import { Skeleton } from "@nemu/ui/components/skeleton";
import { useQuery } from "@tanstack/react-query";

import { currentSchoolQueryOptions } from "@/features/school/api/current-school";
import { orpc } from "@/shared/api/orpc";

/**
 * The school at the bottom of the side menu: its name, how many websites show the Nemu button
 * (WS-03) and how many teachers it has (WS-06). The counts share the Website diizinkan and Guru
 * dan kontak pages' queries, so they follow every change made there.
 */
export default function SchoolCard() {
  const school = useQuery(currentSchoolQueryOptions());
  const sites = useQuery(orpc.listAllowedSites.queryOptions());
  const teachers = useQuery(orpc.listTeachers.queryOptions());

  return (
    <div className="grid gap-0.5 rounded-2xl bg-sidebar-accent px-3 py-2.5">
      {school.data ? (
        <span className="truncate text-[13px] font-semibold text-sidebar-foreground">
          {school.data.name}
        </span>
      ) : (
        <Skeleton className="h-4 w-28" />
      )}
      {sites.data && teachers.data ? (
        <span className="text-xs text-sidebar-foreground/60">
          Tombol Nemu aktif di {sites.data.length} website · {teachers.data.length} guru
        </span>
      ) : (
        <Skeleton className="mt-1 h-3 w-40" />
      )}
    </div>
  );
}
