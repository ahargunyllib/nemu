import { ORPCError } from "@orpc/client";
import { browser } from "wxt/browser";

import { failureMessage } from "../../../shared/api/nemu-service";
import type { PageEmail } from "../../../shared/lib/messages";
import { teacherClient } from "../../identity/api/teacher-client";
import { cropPhoto } from "../lib/crop";
import { claimJobs, holdJob, type InboxClaims, releaseJobs } from "../lib/inbox-claims";
import type { GradePhotoRequest, GradePhotoResponse, GradePhotoValue } from "../lib/requests";

/**
 * Background: the F1 flow's calls to the Nemu Service (#207), the one-tab claim on each photo,
 * and the flow's state per tab in `chrome.storage.session`, which the page never sees.
 */
const CLAIMS_KEY = "inbox-claims";

/** Why there is no teacher to ask as (not installed, signed out), in Nemu's words. */
class Notice extends Error {}
const stateKey = (tabId: number) => `grade-photo:${tabId}`;

async function loadClaims(): Promise<InboxClaims> {
  return ((await browser.storage.session.get(CLAIMS_KEY))[CLAIMS_KEY] as InboxClaims) ?? {};
}

async function saveClaims(claims: InboxClaims) {
  await browser.storage.session.set({ [CLAIMS_KEY]: claims });
}

async function answer(
  request: GradePhotoRequest,
  pageEmail: PageEmail,
  tabId: number | undefined,
): Promise<GradePhotoValue[GradePhotoRequest["op"]]> {
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
  if (request.op === "hold" || request.op === "release") {
    if (tabId === undefined) return null;
    const claims = await loadClaims();
    await saveClaims(
      request.op === "hold"
        ? holdJob(claims, request.jobId, tabId, Date.now())
        : releaseJobs(claims, (jobId) => jobId === request.jobId),
    );
    return null;
  }

  const teacher = await teacherClient(pageEmail);
  if ("notice" in teacher) throw new Notice(teacher.notice);
  const { client } = teacher;
  switch (request.op) {
    case "poll": {
      const jobs = await client.inboxJobs();
      if (tabId === undefined) return [];
      const claimed = claimJobs(await loadClaims(), jobs, tabId, Date.now());
      await saveClaims(claimed.claims);
      return claimed.mine;
    }
    case "title":
      return client.inboxReadTitle({ jobId: request.jobId });
    case "command":
      return client.gradesParseCommand({ utterance: request.utterance });
    case "process":
      return client.inboxProcess({
        jobId: request.jobId,
        className: request.className,
        assessment: request.assessment,
      });
    case "crops":
      return cropPhoto(await client.inboxPhoto({ jobId: request.jobId }), request.boxes);
    case "finalize":
      return client.gradesFinalize({ reading: request.reading, answers: request.answers });
    case "readback": {
      const { saved, ...query } = request;
      try {
        return {
          ...(await client.gradesReadbackAlurSekolah({
            entries: query.entries,
            className: query.className,
            subject: query.subject,
            assessment: query.assessment,
          })),
          source: "alursekolah",
        };
      } catch (error) {
        // AlurSekolah isn't connected in WS-07 yet: compare what the page shows after the save.
        if (!(error instanceof ORPCError) || error.code !== "PRECONDITION_FAILED") throw error;
        return {
          ...(await client.gradesReadback({ entries: query.entries, saved })),
          source: "page",
        };
      }
    }
    case "guided-line":
      return client.gradesGuidedLine({
        entries: request.entries,
        studentId: request.studentId,
        typed: request.typed,
      });
    case "ack": {
      const result = await client.inboxAck({ jobId: request.jobId });
      if (tabId !== undefined)
        await saveClaims(releaseJobs(await loadClaims(), (jobId) => jobId === request.jobId));
      return result;
    }
  }
}

export async function handleGradePhoto(
  request: GradePhotoRequest,
  pageEmail: PageEmail,
  tabId: number | undefined,
): Promise<GradePhotoResponse<GradePhotoRequest["op"]>> {
  try {
    return { ok: true, value: await answer(request, pageEmail, tabId) };
  } catch (error) {
    if (error instanceof Notice) return { ok: false, message: error.message };
    return { ok: false, message: failureMessage(error) };
  }
}

/** A closed tab lets go of its photos and forgets its flow. */
export function forgetGradePhotoTabs() {
  browser.tabs.onRemoved.addListener((tabId) => {
    void browser.storage.session.remove(stateKey(tabId));
    void loadClaims().then((claims) =>
      saveClaims(releaseJobs(claims, (_jobId, claim) => claim.tabId === tabId)),
    );
  });
}
