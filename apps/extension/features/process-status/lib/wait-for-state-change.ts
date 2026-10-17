import type { ProcessInstanceStatus, ProcessState } from "@nemu/contracts/process-instance";

export const POLL_MS = 500;
/** Kirim may be refused (a document is missing); then the State never moves and Nemu stays quiet. */
export const STATE_CHANGE_TIMEOUT_MS = 10_000;

/**
 * Reads the Process Instance until its State is no longer `from`. Resolves `undefined` when it
 * doesn't move in time or the signal aborts.
 */
export async function waitForStateChange(
  read: () => Promise<ProcessInstanceStatus | undefined>,
  from: ProcessState,
  signal: AbortSignal,
  { pollMs = POLL_MS, timeoutMs = STATE_CHANGE_TIMEOUT_MS } = {},
): Promise<ProcessInstanceStatus | undefined> {
  for (const startedAt = Date.now(); Date.now() - startedAt <= timeoutMs;) {
    await new Promise((resolve) => setTimeout(resolve, pollMs));
    if (signal.aborted) return undefined;
    const instance = await read();
    if (instance && instance.state !== from) return instance;
  }
  return undefined;
}
