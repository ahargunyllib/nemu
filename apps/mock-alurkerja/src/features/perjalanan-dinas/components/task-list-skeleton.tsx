import { Skeleton } from "@nemu/ui/components/skeleton";

/** The My Tasks column while the Tasks load: the heading, then search- and row-shaped skeletons. */
export default function TaskListSkeleton() {
  return (
    <div className="flex w-full max-w-68 flex-col gap-3">
      <h1 className="font-heading text-[22px] leading-7 font-medium">My Tasks</h1>
      <Skeleton className="h-8 w-full rounded-4xl" />
      <Skeleton className="h-3.5 w-16" />
      {[0, 1, 2].map((row) => (
        <Skeleton key={row} className="h-13 w-full rounded-xl" />
      ))}
    </div>
  );
}
