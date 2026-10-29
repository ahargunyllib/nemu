import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@nemu/ui/components/empty";
import { Input } from "@nemu/ui/components/input";
import { useState } from "react";

import SlaClaimTaskList from "@/features/sla-claims/components/sla-claim-task-list";
import type { SlaClaim, SlaClaimTaskRow } from "@/features/sla-claims/types/sla-claim-task-row";

/**
 * The Tugas Saya column of the telco workspace: the heading, a search over the Tasks, their claims,
 * and customers, and the Tasks under "Tenggat". With no Tasks at all the route shows a placeholder
 * beside it instead.
 */
export default function SlaClaimTaskColumn({
  claims,
  tasks,
}: {
  claims: readonly SlaClaim[];
  tasks: readonly SlaClaimTaskRow[];
}) {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const customerOf = new Map(claims.map((claim) => [claim.id, claim.customer]));
  const shown = tasks.filter(
    (task) =>
      !needle ||
      [task.name, task.claimId, customerOf.get(task.claimId)].some((text) =>
        text?.toLowerCase().includes(needle),
      ),
  );

  return (
    <div className="flex w-full max-w-68 shrink-0 flex-col gap-3">
      <h1 className="font-heading text-[22px] leading-7 font-medium">Tugas Saya</h1>
      <Input
        type="search"
        aria-label="Cari tugas"
        placeholder="Cari tugas…"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        className="h-8 border-transparent bg-muted text-[13px] leading-[18px] md:text-[13px]"
      />
      {tasks.length === 0 ? null : shown.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>Tidak ada tugas yang cocok</EmptyTitle>
            <EmptyDescription>Coba kata kunci lain.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <h2 className="text-[10.5px] leading-3.5 font-semibold tracking-[0.08em] text-muted-foreground uppercase">
            Tenggat
          </h2>
          <SlaClaimTaskList claims={claims} tasks={shown} />
        </>
      )}
    </div>
  );
}
