import { Checkbox } from "@nemu/ui/components/checkbox";
import { Label } from "@nemu/ui/components/label";
import { Skeleton } from "@nemu/ui/components/skeleton";
import { useQuery } from "@tanstack/react-query";

import { orpc } from "@/shared/api/orpc";

/** Picks the WS-03 websites a document applies to; none ticked means every website. */
export default function SiteChecklist({
  value,
  onChange,
}: {
  value: string[];
  onChange: (siteIds: string[]) => void;
}) {
  const sites = useQuery(orpc.listAllowedSites.queryOptions());
  if (!sites.data) return <Skeleton className="h-24 w-full" />;
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {sites.data.map((site) => (
        <Label key={site.id} className="flex items-center gap-2 font-normal">
          <Checkbox
            checked={value.includes(site.id)}
            onCheckedChange={(checked) =>
              onChange(checked ? [...value, site.id] : value.filter((id) => id !== site.id))
            }
          />
          {site.label}
        </Label>
      ))}
    </div>
  );
}
