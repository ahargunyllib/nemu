import { browser } from "wxt/browser";

import { failureMessage } from "../../../shared/api/nemu-service";
import type { PageEmail } from "../../../shared/lib/messages";
import { teacherClient } from "../../identity/api/teacher-client";
import type { RecorderRequest, RecorderResponse, RecorderValue } from "../lib/requests";

/** Background: hands the recording to the Nemu Service, and keeps it per tab meanwhile (#214). */
const stateKey = (tabId: number) => `recorder:${tabId}`;

async function answer(
  request: RecorderRequest,
  pageEmail: PageEmail,
  tabId: number | undefined,
): Promise<RecorderValue[RecorderRequest["op"]]> {
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
  if ("notice" in teacher) throw new Error(teacher.notice);
  return teacher.client.procedureRecordingSave({
    title: request.title,
    events: request.events,
    narration: request.narration,
  });
}

export async function handleRecorder(
  request: RecorderRequest,
  pageEmail: PageEmail,
  tabId: number | undefined,
): Promise<RecorderResponse<RecorderRequest["op"]>> {
  try {
    return { ok: true, value: await answer(request, pageEmail, tabId) };
  } catch (error) {
    return { ok: false, message: error instanceof Error && !("code" in error) ? error.message : failureMessage(error) };
  }
}

export function forgetRecorderTabs() {
  browser.tabs.onRemoved.addListener((tabId) => {
    void browser.storage.session.remove(stateKey(tabId));
  });
}
