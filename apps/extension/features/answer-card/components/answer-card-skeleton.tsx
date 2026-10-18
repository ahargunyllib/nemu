import { Card, CardContent } from "@nemu/ui/components/card";
import { Skeleton } from "@nemu/ui/components/skeleton";

import { AnswerCardKickerContext } from "../contexts/answer-card-kicker";
import { CARD_BODY } from "../lib/typography";

export function AnswerCardSkeleton({ header }: { header: React.ReactNode }) {
  return (
    <Card
      size="sm"
      aria-busy="true"
      aria-label="Nemu sedang menjawab"
      className={`shadow-lg ${CARD_BODY}`}
    >
      <AnswerCardKickerContext value={{ label: "Membaca…", tone: "nemu", mascot: "thinking" }}>
        {header}
        <CardContent className="flex flex-col gap-2">
          <p className="text-muted-foreground">Membaca halaman dan sumber instansi…</p>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-5 w-28" />
        </CardContent>
      </AnswerCardKickerContext>
    </Card>
  );
}
