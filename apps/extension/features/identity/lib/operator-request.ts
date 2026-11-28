import { whatsAppUrl } from "../../ini-kenapa/lib/whatsapp";
import type { IdentityResult } from "./identity";

/** The page an unregistered teacher opened Nemu on: its heading and its address. */
export type RequestPage = { name: string; url: string };

/**
 * ID-02 (F0-04): for an account that isn't in WS-06, the detail line that names WS-06's operator
 * ("Yang bisa mendaftarkan: Pak Rizal, operator sekolah.") and "Siapkan pesan WA". Like the F2-05
 * hand-off, the button only opens WhatsApp Web with the message ready; the teacher presses Kirim.
 */
export function operatorRequest(
  identity: IdentityResult,
  page: RequestPage,
): { detail: string; label: string; url: string } | undefined {
  if (identity.status !== "unregistered" || !identity.operator) return undefined;
  const name = page.name.trim();
  const text = [
    `Assalamualaikum ${identity.operator.name}.`,
    "Mohon daftarkan akun saya di Nemu.",
    `Email akun: ${identity.email}`,
    `Halaman: ${name ? `${name} (${page.url})` : page.url}`,
    "Terima kasih.",
  ].join("\n");
  return {
    detail: `Yang bisa mendaftarkan: ${identity.operator.name}, operator sekolah.`,
    label: "Siapkan pesan WA",
    url: whatsAppUrl({ phone: identity.operator.phone, text }),
  };
}

/** The page as the teacher sees it: its first heading (else its title) and its address. */
export function currentRequestPage(doc: Document, location: Location): RequestPage {
  const heading = doc.querySelector("h1")?.textContent?.trim();
  // Without the query string, which can carry tokens; AlurSekolah's routes are in the hash.
  return {
    name: heading || doc.title,
    url: `${location.origin}${location.pathname}${location.hash}`,
  };
}
