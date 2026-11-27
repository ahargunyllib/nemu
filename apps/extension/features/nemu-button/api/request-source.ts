import { browser } from "wxt/browser";

import type { NemuMessage, PageEmail } from "../../../shared/lib/messages";
import type { SourceFile } from "../lib/answer";
import type { OpenSourceResult } from "./open-source-file";

/** Content script: asks the background to open a cited document in a new tab (#258). */
export async function requestSourceFile(
  pageEmail: PageEmail,
  file: SourceFile,
): Promise<OpenSourceResult> {
  const message: NemuMessage = {
    type: "nemu:open-source",
    pageEmail,
    docId: file.docId,
    page: file.page,
  };
  try {
    return (await browser.runtime.sendMessage(message)) as OpenSourceResult;
  } catch {
    return { notice: "Nemu belum siap. Muat ulang halaman ini." };
  }
}
