import { browser } from "wxt/browser";

import { failureMessage } from "../../../shared/api/nemu-service";
import type { PageEmail } from "../../../shared/lib/messages";
import { cropPhoto } from "../../grade-photo/lib/crop";
import { teacherClient } from "../../identity/api/teacher-client";
import type { ProcessRunRequest, ProcessRunResponse, ProcessRunValue } from "../lib/requests";

/** Background: the F3 flow's calls to the Nemu Service (#213) and its state per tab. */
class Notice extends Error {}
const stateKey = (tabId: number) => `process-run:${tabId}`;

function sameName(a: string, b: string) {
  return a.trim().toLocaleLowerCase("id-ID") === b.trim().toLocaleLowerCase("id-ID");
}

async function answer(
  request: ProcessRunRequest,
  pageEmail: PageEmail,
  tabId: number | undefined,
): Promise<ProcessRunValue[ProcessRunRequest["op"]]> {
  if (request.op === "state-save") {
    if (tabId === undefined) return null;
    if (request.state === null) await browser.storage.session.remove(stateKey(tabId));
    else await browser.storage.session.set({ [stateKey(tabId)]: request.state });
    return null;
  }
  if (request.op === "state-load") {
    if (tabId === undefined) return null;
    return (await browser.storage.session.get(stateKey(tabId)))[stateKey(tabId)] ?? null;
  }

  const teacher = await teacherClient(pageEmail);
  if ("notice" in teacher) throw new Notice(teacher.notice);
  const { client } = teacher;
  switch (request.op) {
    case "find": {
      const found = (await client.processList()).find((item) =>
        sameName(item.title, request.processName),
      );
      if (found) return { documentId: found.documentId, title: found.title, kind: "bpmn" };
      const recorded = (await client.procedureList()).find((item) =>
        sameName(item.title, request.processName),
      );
      return recorded
        ? { documentId: recorded.documentId, title: recorded.title, kind: "procedure" }
        : null;
    }
    case "run-procedure":
      return client.procedureRun({ documentId: request.documentId, values: request.values });
    case "plan":
      return client.processPlan(request.input);
    case "jobs":
      return client.inboxJobs();
    case "read-photo":
      return client.processReadPhoto({
        documentId: request.documentId,
        jobId: request.jobId,
        taskId: request.taskId,
        slots: request.slots,
      });
    case "crops":
      return cropPhoto(await client.inboxPhoto({ jobId: request.jobId }), request.boxes);
    case "match-fields":
      return client.processMatchFields({ fields: request.fields, pageLabels: request.pageLabels });
    case "ack":
      return client.inboxAck({ jobId: request.jobId });
  }
}

export async function handleProcessRun(
  request: ProcessRunRequest,
  pageEmail: PageEmail,
  tabId: number | undefined,
): Promise<ProcessRunResponse<ProcessRunRequest["op"]>> {
  try {
    return { ok: true, value: await answer(request, pageEmail, tabId) };
  } catch (error) {
    if (error instanceof Notice) return { ok: false, message: error.message };
    return { ok: false, message: failureMessage(error) };
  }
}

/** A closed tab forgets its flow. */
export function forgetProcessRunTabs() {
  browser.tabs.onRemoved.addListener((tabId) => {
    void browser.storage.session.remove(stateKey(tabId));
  });
}
