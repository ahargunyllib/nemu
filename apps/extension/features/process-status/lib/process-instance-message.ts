import type { ProcessInstanceStatus } from "@nemu/contracts/process-instance";

/** Asks the background to call `get_process_instance` with the Demo App session. */
export type ProcessInstanceRequestMessage = { type: "nemu:process-instance"; instanceId: string };

export type ProcessInstanceResult =
  | { kind: "instance"; instance: ProcessInstanceStatus }
  | { kind: "error" };

export function isProcessInstanceRequestMessage(
  message: unknown,
): message is ProcessInstanceRequestMessage {
  return (
    typeof message === "object" &&
    message !== null &&
    "type" in message &&
    message.type === "nemu:process-instance" &&
    "instanceId" in message &&
    typeof message.instanceId === "string"
  );
}

const TASK_PAGE = /^\/perdin\/task\/([^/]+)\/?$/u;

/** The Process Instance a Demo App task page (`/perdin/task/$instanceId`) shows, if it is one. */
export function taskInstanceIdOf(url: string): string | undefined {
  if (!URL.canParse(url)) return undefined;
  const match = TASK_PAGE.exec(new URL(url).pathname);
  return match?.[1] && decodeURIComponent(match[1]);
}
