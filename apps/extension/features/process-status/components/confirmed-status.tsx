import type { ConfirmedStatus as Status } from "../hooks/use-confirmed-status";

/**
 * What the Answer Card says once the user's press went through, as plain text: the State the task
 * moved to and its ID.
 */
export function ConfirmedStatus({ status }: { status: Status }) {
  return (
    <section aria-label="Status tugas">
      <p>
        Terkirim, pindah ke <span className="font-medium">{status.state}</span>. ID tugas{" "}
        {status.taskId}.
      </p>
    </section>
  );
}
