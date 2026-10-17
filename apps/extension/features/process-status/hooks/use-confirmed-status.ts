import type { NemuAction } from "@nemu/contracts";
import type { ProcessState } from "@nemu/contracts/process-instance";
import { useEffect, useState } from "react";

import { fetchProcessInstance } from "../api/process-instance-messaging";
import { taskInstanceIdOf } from "../lib/process-instance-message";
import { waitForStateChange } from "../lib/wait-for-state-change";

export type ConfirmedStatus = { taskId: string; state: ProcessState };

/**
 * On a task page, waits for the user to press the target of the answer's `confirm` (Nemu never
 * presses it), then returns the task ID and the State the Process Instance moved to, both from
 * `get_process_instance`. Momen 3: Kirim moves Pertanggungjawaban to Verifikasi.
 */
export function useConfirmedStatus(actions: readonly NemuAction[]): ConfirmedStatus | null {
  const target = actions.find((action) => action.type === "confirm")?.target;
  const [status, setStatus] = useState<ConfirmedStatus | null>(null);

  useEffect(() => {
    setStatus(null);
    const instanceId = taskInstanceIdOf(window.location.href);
    if (!target || !instanceId) return;

    const controller = new AbortController();
    // Read before the press: the task ID belongs to the Task, which ends once the State moves.
    const before = fetchProcessInstance(instanceId);

    async function showStateChange() {
      const instance = await before;
      if (!instance || !instanceId) return;
      const after = await waitForStateChange(
        () => fetchProcessInstance(instanceId),
        instance.state,
        controller.signal,
      );
      if (after && !controller.signal.aborted) {
        setStatus({ taskId: instance.activeTask?.id ?? instance.id, state: after.state });
      }
    }

    function onPress(event: MouseEvent) {
      // The contract limits a nemu_id to [a-zA-Z0-9:_-], so it is safe inside a quoted selector.
      if (event.target instanceof Element && event.target.closest(`[data-nemu-id="${target}"]`)) {
        void showStateChange();
      }
    }
    document.addEventListener("click", onPress, { capture: true });

    return () => {
      controller.abort();
      document.removeEventListener("click", onPress, { capture: true });
    };
  }, [target]);

  return status;
}
