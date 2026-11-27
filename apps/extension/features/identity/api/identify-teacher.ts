import { createNemuServiceClient, failureMessage } from "../../../shared/api/nemu-service";
import { installCodeItem, pageEmailItem } from "../../../shared/lib/extension-storage";
import type { PageEmail } from "../../../shared/lib/messages";
import { type IdentityResult, NOT_INSTALLED_MESSAGE, SIGNED_OUT_MESSAGE } from "../lib/identity";

/**
 * The email to ask as: what an AlurSekolah page shows now (remembered, so signing out or switching
 * accounts there carries over to other tabs), or the remembered one on sites without an account.
 */
export async function resolveEmail(pageEmail: PageEmail): Promise<string | null> {
  if (pageEmail.kind === "unreadable") return pageEmailItem.getValue();
  await pageEmailItem.setValue(pageEmail.email);
  return pageEmail.email;
}

/** Background: matches the page's account against WS-06 through the Nemu Service. */
export async function identifyTeacher(pageEmail: PageEmail): Promise<IdentityResult> {
  const [installCode, email] = await Promise.all([
    installCodeItem.getValue(),
    resolveEmail(pageEmail),
  ]);
  if (!installCode) return { status: "not_installed", message: NOT_INSTALLED_MESSAGE };
  if (!email) return { status: "signed_out", message: SIGNED_OUT_MESSAGE };
  try {
    return await createNemuServiceClient({ installCode, email }).extensionIdentify();
  } catch (error) {
    return { status: "error", message: failureMessage(error) };
  }
}
