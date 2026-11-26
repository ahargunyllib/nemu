import { createNemuServiceClient, type NemuServiceClient } from "../../../shared/api/nemu-service";
import { installCodeItem } from "../../../shared/lib/extension-storage";
import type { PageEmail } from "../../../shared/lib/messages";
import { NOT_INSTALLED_MESSAGE, SIGNED_OUT_MESSAGE } from "../lib/identity";
import { resolveEmail } from "./identify-teacher";

/**
 * Background: a Nemu Service client that asks as the teacher whose email the page shows
 * (ADR-0015), or the sentence that says why there is none.
 */
export async function teacherClient(
  pageEmail: PageEmail,
): Promise<{ client: NemuServiceClient } | { notice: string }> {
  const [installCode, email] = await Promise.all([
    installCodeItem.getValue(),
    resolveEmail(pageEmail),
  ]);
  if (!installCode) return { notice: NOT_INSTALLED_MESSAGE };
  if (!email) return { notice: SIGNED_OUT_MESSAGE };
  return { client: createNemuServiceClient({ installCode, email }) };
}
