import type { ActionLogEntry } from "@nemu/contracts/executor";

import type { PageEmail } from "../../../shared/lib/messages";
import { teacherClient } from "../../identity/api/teacher-client";

/**
 * Background: writes the executor's actions to the action log (WS-10) as the teacher on the page.
 * The log is a record, not part of the work: a failure is reported and the task goes on.
 */
export async function recordActions(request: {
  pageEmail: PageEmail;
  entries: ActionLogEntry[];
}): Promise<void> {
  const teacher = await teacherClient(request.pageEmail);
  if ("notice" in teacher) return;
  try {
    await teacher.client.actionLogRecord({ entries: request.entries });
  } catch (error) {
    console.warn("[nemu] could not write the action log", error);
  }
}
