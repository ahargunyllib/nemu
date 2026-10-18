import { buttonVariants } from "@nemu/ui/components/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@nemu/ui/components/card";
import { cn } from "@nemu/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import { ChevronRight, Star } from "lucide-react";
import type { ReactNode } from "react";
import { toast } from "sonner";

import ProcessBadge from "@/features/processes/components/process-badge";
import { ALL_PROCESSES_COUNT, FAVORITE_PROCESSES } from "@/features/processes/lib/processes";

const ENTRY_CLASS = cn(
  buttonVariants({ variant: "outline" }),
  "h-auto justify-start gap-3 rounded-2xl p-3 text-left whitespace-normal",
);

export default function FavoriteProcessesCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5">
          Favorite Processes
          <Star aria-hidden className="size-4 fill-current text-muted-foreground" />
        </CardTitle>
        <CardAction className="flex items-center text-sm text-muted-foreground">
          All processes · {ALL_PROCESSES_COUNT}
          <ChevronRight aria-hidden className="size-4" />
        </CardAction>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-3">
        {FAVORITE_PROCESSES.map((process) => {
          const body: ReactNode = (
            <>
              <ProcessBadge code={process.code} tone={process.tone} />
              <span className="grid gap-0.5">
                <span className="font-medium">{process.name}</span>
                <span className="text-xs font-normal text-muted-foreground">
                  {process.description}
                </span>
              </span>
            </>
          );
          return "to" in process ? (
            <Link
              key={process.code}
              to={process.to}
              data-nemu-id={process.nemuId}
              className={ENTRY_CLASS}
            >
              {body}
            </Link>
          ) : (
            <button
              key={process.code}
              type="button"
              data-nemu-id={process.nemuId}
              className={ENTRY_CLASS}
              onClick={() => toast.info(`${process.name} belum tersedia di Demo App`)}
            >
              {body}
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
}
