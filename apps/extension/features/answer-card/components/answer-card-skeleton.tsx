import { Card, CardContent } from "@nemu/ui/components/card";
import { Skeleton } from "@nemu/ui/components/skeleton";

export function AnswerCardSkeleton({ header }: { header: React.ReactNode }) {
  return (
    <Card size="sm" aria-busy="true" aria-label="Nemu sedang menjawab" className="shadow-lg">
      {header}
      <CardContent className="flex flex-col gap-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-10 w-full" />
        <div className="flex gap-1">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-6 w-20" />
        </div>
      </CardContent>
    </Card>
  );
}
