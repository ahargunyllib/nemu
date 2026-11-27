import { browser } from "wxt/browser";

import { failureMessage } from "../../../shared/api/nemu-service";
import type { PageEmail } from "../../../shared/lib/messages";
import { teacherClient } from "../../identity/api/teacher-client";
import type { QuizCheckRequest, QuizCheckResponse, QuizCheckValue } from "../lib/requests";

/** Background: F4-01's call to the Nemu Service (#209) and its pointing state per tab. */
class Notice extends Error {}
const stateKey = (tabId: number) => `quiz-check:${tabId}`;

async function answer(
  request: QuizCheckRequest,
  pageEmail: PageEmail,
  tabId: number | undefined,
): Promise<QuizCheckValue[QuizCheckRequest["op"]]> {
  switch (request.op) {
    case "state-save":
      if (tabId === undefined) return null;
      if (request.state === null) await browser.storage.session.remove(stateKey(tabId));
      else await browser.storage.session.set({ [stateKey(tabId)]: request.state });
      return null;
    case "state-load":
      if (tabId === undefined) return null;
      return (await browser.storage.session.get(stateKey(tabId)))[stateKey(tabId)] ?? null;
    case "judge": {
      const teacher = await teacherClient(pageEmail);
      if ("notice" in teacher) throw new Notice(teacher.notice);
      return teacher.client.quizJudge(request.input);
    }
  }
}

export async function handleQuizCheck(
  request: QuizCheckRequest,
  pageEmail: PageEmail,
  tabId: number | undefined,
): Promise<QuizCheckResponse<QuizCheckRequest["op"]>> {
  try {
    return { ok: true, value: await answer(request, pageEmail, tabId) };
  } catch (error) {
    if (error instanceof Notice) return { ok: false, message: error.message };
    return { ok: false, message: failureMessage(error) };
  }
}

/** A closed tab forgets its check. */
export function forgetQuizCheckTabs() {
  browser.tabs.onRemoved.addListener((tabId) => {
    void browser.storage.session.remove(stateKey(tabId));
  });
}
