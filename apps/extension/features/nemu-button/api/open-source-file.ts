import type { DocumentFileLink } from "@nemu/contracts/school";
import { browser } from "wxt/browser";

import { failureMessage, type NemuServiceClient } from "../../../shared/api/nemu-service";
import { serverUrl } from "../../../shared/lib/config";
import type { PageEmail } from "../../../shared/lib/messages";
import { teacherClient } from "../../identity/api/teacher-client";
import type { SourceFile } from "../lib/answer";

export type OpenSourceResult = { opened: true } | { notice: string };

type OpenSourceDeps = {
  client: Pick<NemuServiceClient, "documentFileLink">;
  openTab: (url: string) => Promise<unknown>;
  serverUrl: string;
};

/**
 * Sumber (#258): the tab carries none of the headers that say who the teacher is (ADR-0015), so
 * the Nemu Service checks her school reads the document and hands back a short-lived signed link.
 * The browser's PDF viewer opens it at `#page=`.
 */
export async function openSourceFile(
  { client, openTab, serverUrl: base }: OpenSourceDeps,
  file: Pick<SourceFile, "docId" | "page">,
): Promise<OpenSourceResult> {
  let link: DocumentFileLink;
  try {
    link = await client.documentFileLink({ id: file.docId });
  } catch (error) {
    return { notice: failureMessage(error) };
  }
  await openTab(`${base}${link.path}${file.page === null ? "" : `#page=${file.page}`}`);
  return { opened: true };
}

/** Background: opens a cited document for the teacher whose email the page shows. */
export async function openSourceForPage(
  request: { pageEmail: PageEmail; docId: string; page: number | null },
  tab?: { id?: number; index?: number; windowId?: number },
): Promise<OpenSourceResult> {
  const teacher = await teacherClient(request.pageEmail);
  if ("notice" in teacher) return { notice: teacher.notice };
  return openSourceFile(
    {
      client: teacher.client,
      serverUrl: serverUrl(),
      openTab: (url) =>
        browser.tabs.create({
          url,
          openerTabId: tab?.id,
          windowId: tab?.windowId,
          index: tab?.index === undefined ? undefined : tab.index + 1,
        }),
    },
    request,
  );
}
