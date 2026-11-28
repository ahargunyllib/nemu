import { Button } from "@nemu/ui/components/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@nemu/ui/components/card";
import { Skeleton } from "@nemu/ui/components/skeleton";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

import { integrationSummaryRows } from "@/features/integrations/lib/summary";
import { orpc } from "@/shared/api/orpc";

/** WS-07 at a glance beside the websites (F3-15): which systems Nemu reaches, with keys masked. */
export default function IntegrationSummary() {
  const secrets = useQuery(orpc.listIntegrationSecrets.queryOptions());
  const rows = secrets.data ? integrationSummaryRows(secrets.data) : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Integrasi</CardTitle>
        <CardDescription>Diisi Admin Javan · kunci disimpan terenkripsi di server</CardDescription>
        <CardAction>
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link to="/integrations" />}
          >
            Ubah
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-4">
          {rows
            ? rows.map((row) => (
                <div key={row.label} className="grid gap-0.5">
                  <dt className="text-muted-foreground">{row.label}</dt>
                  <dd className={row.value ? "font-medium" : "text-muted-foreground"}>
                    {row.value ?? "Belum diisi"}
                  </dd>
                </div>
              ))
            : ["a", "b", "c"].map((key) => (
                <div key={key} className="grid gap-1.5">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-56" />
                </div>
              ))}
        </dl>
      </CardContent>
      <CardFooter className="text-muted-foreground">
        Kunci tidak bisa ditampilkan lagi setelah disimpan.
      </CardFooter>
    </Card>
  );
}
