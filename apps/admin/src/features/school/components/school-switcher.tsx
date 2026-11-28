import { Button } from "@nemu/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@nemu/ui/components/dropdown-menu";
import { Skeleton } from "@nemu/ui/components/skeleton";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ChevronDownIcon } from "lucide-react";

import { currentSchoolQueryOptions } from "@/features/school/api/current-school";
import { orpc } from "@/shared/api/orpc";

/**
 * "Sekolah: SDIT Nusantara" in the top bar. An operator, or Admin Javan with one school, sees the
 * name; Admin Javan with several schools gets them in a dropdown.
 */
export default function SchoolSwitcher({ fullAdmin }: { fullAdmin: boolean }) {
  const current = useQuery(currentSchoolQueryOptions());
  // WS-01's school list is Admin Javan's only.
  const schools = useQuery({ ...orpc.listSchools.queryOptions(), enabled: fullAdmin });

  if (!current.data) return <Skeleton className="h-9 w-44 rounded-4xl" />;

  const label = (
    <>
      <span className="text-muted-foreground">Sekolah:</span>
      <span className="font-semibold">{current.data.name}</span>
    </>
  );

  if (!schools.data || schools.data.length < 2) {
    return (
      <div className="hidden h-9 items-center gap-1 rounded-4xl border px-3 md:flex">{label}</div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" className="hidden md:inline-flex" />}>
        {label}
        <ChevronDownIcon data-icon="inline-end" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Sekolah</DropdownMenuLabel>
          {/* A session belongs to one school's workspace, so the others are listed, not opened. */}
          <DropdownMenuRadioGroup value={current.data.id}>
            {schools.data.map((school) => (
              <DropdownMenuRadioItem
                key={school.id}
                value={school.id}
                disabled={school.id !== current.data.id}
              >
                {school.name}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link to="/schools" />}>Daftar sekolah</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
