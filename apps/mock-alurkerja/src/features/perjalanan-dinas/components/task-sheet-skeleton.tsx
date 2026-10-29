import { Skeleton } from "@nemu/ui/components/skeleton";

/** The task sheet while its Process Instance loads: header, tabs, and document rows. */
export default function TaskSheetSkeleton() {
  return (
    <>
      <div className="flex flex-col gap-3 border-b px-6 pt-4 pb-4.5">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-8 w-64" />
        <div className="flex items-end justify-between gap-6">
          <Skeleton className="h-9 w-72" />
          <Skeleton className="h-9 w-56 rounded-4xl" />
        </div>
      </div>
      <div className="flex flex-col gap-4 px-6 py-4">
        <Skeleton className="h-9 w-96 self-center rounded-4xl" />
        <Skeleton className="h-5 w-64" />
        <Skeleton className="h-4 w-80" />
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-12 w-full rounded-2xl" />
        ))}
      </div>
    </>
  );
}
