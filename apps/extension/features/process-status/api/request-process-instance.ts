import { processInstanceStatusSchema } from "@nemu/contracts/process-instance";

import { isAllowedPage } from "../../../shared/lib/config";
import type { ProcessInstanceResult } from "../lib/process-instance-message";

/** The reply is `unknown` until it passes the contract. */
export type ProcessInstanceClient = {
  getProcessInstance(input: { instanceId: string }): Promise<unknown>;
};

/** Background side: reads one of the signed-in user's Process Instances for a Demo App tab. */
export async function requestProcessInstance(
  client: ProcessInstanceClient,
  instanceId: string,
  pageUrl: string | undefined,
): Promise<ProcessInstanceResult> {
  if (!isAllowedPage(pageUrl)) return { kind: "error" };
  try {
    const instance = processInstanceStatusSchema.parse(
      await client.getProcessInstance({ instanceId }),
    );
    return { kind: "instance", instance };
  } catch (error) {
    console.error("[nemu] getProcessInstance failed", error);
    return { kind: "error" };
  }
}
