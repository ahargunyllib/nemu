import { Badge } from "@nemu/ui/components/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@nemu/ui/components/card";
import { Skeleton } from "@nemu/ui/components/skeleton";
import { Table, TableBody, TableCell, TableRow } from "@nemu/ui/components/table";
import { useQuery } from "@tanstack/react-query";

import AlurSekolahConnectionCheck from "@/features/integrations/components/alursekolah-connection-check";
import SecretDialog from "@/features/integrations/components/secret-dialog";
import { SETTING_GROUPS } from "@/features/integrations/lib/settings";
import { orpc } from "@/shared/api/orpc";

/** WS-07: one card per school system; each value shows only whether it is set and its last 4. */
export default function IntegrationSettings() {
  const secrets = useQuery(orpc.listIntegrationSecrets.queryOptions());
  const lastFour = (name: string) =>
    secrets.data?.find((secret) => secret.name === name)?.lastFour ?? null;

  return SETTING_GROUPS.map((group) => (
    <Card key={group.id}>
      <CardHeader>
        <CardTitle>{group.title}</CardTitle>
        <CardDescription>{group.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableBody>
            {group.fields.map((field) => {
              const last = lastFour(field.name);
              return (
                <TableRow key={field.name}>
                  <TableCell>
                    <div className="font-medium">{field.label}</div>
                    <div className="text-muted-foreground">{field.description}</div>
                  </TableCell>
                  <TableCell className="w-56">
                    {secrets.data ? (
                      last ? (
                        <Badge variant="secondary">terpasang · …{last}</Badge>
                      ) : (
                        <span className="text-muted-foreground">Belum diisi</span>
                      )
                    ) : (
                      <Skeleton className="h-5 w-32" />
                    )}
                  </TableCell>
                  <TableCell className="w-0 text-right">
                    <SecretDialog field={field} isSet={last !== null} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
      {group.id === "alursekolah" && (
        <CardFooter>
          <AlurSekolahConnectionCheck
            ready={group.fields.every((field) => lastFour(field.name) !== null)}
          />
        </CardFooter>
      )}
    </Card>
  ));
}
