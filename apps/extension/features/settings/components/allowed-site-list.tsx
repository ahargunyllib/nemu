import { Badge } from "@nemu/ui/components/badge";
import { Button } from "@nemu/ui/components/button";
import type { AllowedSite } from "@nemu/contracts/extension";

type AllowedSiteListProps = {
  sites: readonly AllowedSite[];
  granted: ReadonlySet<string>;
  onGrant: (site: AllowedSite) => void;
};

/**
 * The school's WS-03 list: Nemu appears only on these sites. One the browser can't reach yet gets
 * an **Izinkan** button that asks Chrome for it.
 */
export function AllowedSiteList({ sites, granted, onGrant }: AllowedSiteListProps) {
  if (sites.length === 0) {
    return <p className="text-sm text-muted-foreground">Sekolah belum memilih situs untuk Nemu.</p>;
  }
  return (
    <ul className="flex flex-col divide-y">
      {sites.map((site) => (
        <li key={site.pattern} className="flex items-center justify-between gap-4 py-3">
          <div className="flex min-w-0 flex-col">
            <span className="text-sm font-medium">{site.label}</span>
            <span className="truncate text-sm text-muted-foreground">{site.pattern}</span>
          </div>
          {granted.has(site.pattern) ? (
            <Badge variant="secondary">Aktif</Badge>
          ) : (
            <Button type="button" size="sm" variant="outline" onClick={() => onGrant(site)}>
              Izinkan
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}
