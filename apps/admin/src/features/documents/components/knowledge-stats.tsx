import { Card, CardAction, CardDescription, CardHeader, CardTitle } from "@nemu/ui/components/card";
import { Skeleton } from "@nemu/ui/components/skeleton";
import { useQuery } from "@tanstack/react-query";
import {
  BookOpenIcon,
  ListChecksIcon,
  type LucideIcon,
  MessageCircleQuestionIcon,
  WorkflowIcon,
} from "lucide-react";

import { useTeacherQuestionStats } from "@/features/documents/hooks/use-teacher-question-stats";
import { orpc } from "@/shared/api/orpc";

/** Dokumen dan alur's four stat cards: active knowledge, BPMN, teacher questions, recordings. */
export default function KnowledgeStats() {
  const { data: stats } = useQuery(orpc.knowledgeStats.queryOptions());
  const { data: questions } = useTeacherQuestionStats();

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        label="Pengetahuan aktif"
        icon={BookOpenIcon}
        value={stats?.active.total}
        hint={stats && `${stats.active.package} paket bawaan, ${stats.active.school} sekolah`}
      />
      <StatCard
        label="Alur BPMN"
        icon={WorkflowIcon}
        value={stats?.processes.count}
        hint={
          stats &&
          (stats.processes.count === 0
            ? "belum ada alur"
            : `${stats.processes.tasks} task, ${
                stats.processes.unmappedTasks === 0
                  ? "semua terpetakan"
                  : `${stats.processes.unmappedTasks} belum terpetakan`
              }`)
        }
      />
      <StatCard
        label="Pertanyaan guru"
        icon={MessageCircleQuestionIcon}
        value={questions?.askedThisWeek ?? "—"}
        hint={
          questions
            ? `pekan ini · ${questions.unansweredThisWeek} belum terjawab`
            : "pekan ini · belum dicatat"
        }
      />
      <StatCard
        label="Rekaman cara"
        icon={ListChecksIcon}
        value={stats?.recordings.count}
        hint={
          stats &&
          (stats.recordings.latestSteps === null
            ? "belum ada rekaman aktif"
            : `${stats.recordings.latestSteps} langkah · siap diputar`)
        }
      />
    </div>
  );
}

function StatCard({
  label,
  icon: Icon,
  value,
  hint,
}: {
  label: string;
  icon: LucideIcon;
  value: number | string | undefined;
  hint: string | undefined;
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="flex items-baseline gap-2">
          {value === undefined ? (
            <Skeleton className="h-8 w-40" />
          ) : (
            <>
              <span className="text-3xl font-semibold tabular-nums">{value}</span>
              <span className="text-sm font-normal text-muted-foreground">{hint}</span>
            </>
          )}
        </CardTitle>
        <CardAction>
          <span className="flex size-8 items-center justify-center rounded-xl bg-muted">
            <Icon className="size-4 text-muted-foreground" />
          </span>
        </CardAction>
      </CardHeader>
    </Card>
  );
}
