import { Badge } from "@nemu/ui/components/badge";
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from "@nemu/ui/components/card";
import { Skeleton } from "@nemu/ui/components/skeleton";
import { useQuery } from "@tanstack/react-query";
import { ServerIcon } from "lucide-react";

import { orpc } from "@/shared/api/orpc";

export default function ServiceStatusCard() {
  const healthCheck = useQuery(orpc.healthCheck.queryOptions());

  return (
    <Card>
      <CardHeader>
        <CardDescription>Nemu Service</CardDescription>
        <CardTitle className="flex h-9 items-center">
          {healthCheck.isPending ? (
            <Skeleton className="h-6 w-24" />
          ) : healthCheck.data ? (
            <Badge variant="secondary">Connected</Badge>
          ) : (
            <Badge variant="destructive">Disconnected</Badge>
          )}
        </CardTitle>
        <CardAction>
          <ServerIcon className="size-4 text-muted-foreground" />
        </CardAction>
        <p className="text-xs text-muted-foreground">Backend health check</p>
      </CardHeader>
    </Card>
  );
}
