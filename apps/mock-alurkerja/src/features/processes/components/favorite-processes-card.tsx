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
  buttonVariants({ variant: "ghost" }),
  "-mx-2 justify-start gap-2.5 px-2 font-normal",
);

/** The user's favourite processes in one row, each a shortcut to start it. */
export default function FavoriteProcessesCard() {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5">
          Proses Favorit
          <Star aria-hidden className="size-3.5 fill-current" />
        </CardTitle>
        <CardAction className="flex items-center text-xs text-muted-foreground">
          Semua proses · {ALL_PROCESSES_COUNT}
          <ChevronRight aria-hidden className="size-3.5" />
        </CardAction>
      </CardHeader>
      <CardContent className="grid gap-x-6 gap-y-1 sm:grid-cols-3">
        {FAVORITE_PROCESSES.map((process) => {
          const body: ReactNode = (
            <>
              <ProcessBadge
                code={process.code}
                tone={process.tone}
                className="size-6 rounded-md text-[0.625rem]"
              />
              {process.name}
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
