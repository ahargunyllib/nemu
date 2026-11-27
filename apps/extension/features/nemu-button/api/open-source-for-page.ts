import { browser } from "wxt/browser";

import { serverUrl } from "../../../shared/lib/config";
import type { PageEmail } from "../../../shared/lib/messages";
import { teacherClient } from "../../identity/api/teacher-client";
import { openSourceFile, type OpenSourceResult } from "./open-source-file";

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
