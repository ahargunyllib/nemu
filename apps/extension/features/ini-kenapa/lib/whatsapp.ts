/**
 * The WhatsApp Web link that opens a ready message (F2-05). Nemu only opens it; the teacher reads
 * it and presses Kirim herself. No screenshot goes with it.
 */
export function whatsAppUrl(draft: { phone: string; text: string }): string {
  const phone = draft.phone.replace(/\D+/gu, "").replace(/^0/u, "62");
  return `https://web.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(draft.text)}`;
}
