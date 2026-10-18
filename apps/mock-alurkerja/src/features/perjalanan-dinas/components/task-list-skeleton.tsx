import { Skeleton } from "@nemu/ui/components/skeleton";
import { PageHeading } from "@nemu/ui/shell/page-heading";

/** The My Tasks column while the Tasks load: the heading, then search- and row-shaped skeletons. */
export default function TaskListSkeleton() {
  return (
    <div className="flex w-full max-w-xs flex-col gap-3">
      <PageHeading title="My Tasks" />
      <Skeleton className="h-8 w-full rounded-4xl" />
      <Skeleton className="h-4 w-20" />
      <div className="flex flex-col gap-2">
        {[0, 1, 2].map((row) => (
          <Skeleton key={row} className="h-13 w-full rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
