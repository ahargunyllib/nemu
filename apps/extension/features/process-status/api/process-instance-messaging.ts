import type { ProcessInstanceStatus } from "@nemu/contracts/process-instance";
import { browser } from "wxt/browser";

import type {
  ProcessInstanceRequestMessage,
  ProcessInstanceResult,
} from "../lib/process-instance-message";

/** Content-script side: the background holds the server access. `undefined` when it fails. */
export async function fetchProcessInstance(
  instanceId: string,
): Promise<ProcessInstanceStatus | undefined> {
  const message: ProcessInstanceRequestMessage = { type: "nemu:process-instance", instanceId };
  try {
    const result: ProcessInstanceResult | undefined = await browser.runtime.sendMessage(message);
    return result?.kind === "instance" ? result.instance : undefined;
  } catch {
    return undefined;
  }
}
