import type { ConfirmedStatus as Status } from "../hooks/use-confirmed-status";

/**
 * What the Answer Card shows once the user's press went through: a black toast with the State the
 * task moved to and its ID.
 */
export function ConfirmedStatus({ status }: { status: Status }) {
  return (
    <section
      aria-label="Status tugas"
      className="flex flex-col gap-0.5 rounded-2xl bg-primary px-3 py-2 text-primary-foreground shadow-md"
    >
      <p className="flex items-center gap-2 font-medium">
        <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-nemu-success" />
        <span>
          Terkirim · pindah ke <strong>{status.state}</strong>
        </span>
      </p>
      <p className="pl-4 text-primary-foreground/70">
        ID tugas <span className="font-medium text-primary-foreground">{status.taskId}</span>
      </p>
    </section>
  );
}
