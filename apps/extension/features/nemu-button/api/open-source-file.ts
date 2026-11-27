import type { DocumentFileLink } from "@nemu/contracts/school";

import { failureMessage, type NemuServiceClient } from "../../../shared/api/nemu-service";
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
