import { Skeleton } from "@nemu/ui/components/skeleton";

export default function RequestTableSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true">
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
    </div>
  );
}
