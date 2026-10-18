import { NEMU_IDS } from "@nemu/contracts/nemu-ids";
import { Badge } from "@nemu/ui/components/badge";
import { buttonVariants } from "@nemu/ui/components/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@nemu/ui/components/card";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";

import TaskList from "@/features/perjalanan-dinas/components/task-list";
import TaskListSkeleton from "@/features/perjalanan-dinas/components/task-list-skeleton";
import { orpc } from "@/shared/api/orpc";

// The filters as AlurKerja shows them; the demo's few Tasks always list under All Tasks.
const FILTERS = ["Overdue", "Due Today", "Upcoming", "All Tasks"] as const;

/** Up next on Beranda: the signed-in user's Tasks, each opening its task page. */
export default function UpNextCard() {
  const { data: tasks } = useQuery(orpc.listMyTasks.queryOptions());

  return (
    <Card>
      <CardHeader>
        <CardTitle>Up next</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((filter) => (
            <Badge key={filter} variant={filter === "All Tasks" ? "default" : "outline"}>
              {filter}
            </Badge>
          ))}
        </div>
        {tasks ? <TaskList tasks={tasks} /> : <TaskListSkeleton />}
      </CardContent>
      {tasks && tasks.length > 0 && (
        <CardFooter>
          <Link
            to="/my-task"
            data-nemu-id={NEMU_IDS.task.viewAll}
            className={buttonVariants({ variant: "link", size: "sm", className: "px-0" })}
          >
            View all {tasks.length} {tasks.length === 1 ? "task" : "tasks"}
            <ChevronRight />
          </Link>
        </CardFooter>
      )}
    </Card>
  );
}
