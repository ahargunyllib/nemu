/**
 * The WhatsApp Web link that opens a ready message (F2-05). Nemu only opens it; the teacher reads
 * it and presses Kirim herself. No screenshot goes with it. Without a phone (a reply to a parent,
 * F2-08, whose number Nemu doesn't keep) WhatsApp Web asks the teacher which chat it goes to.
 */
export function whatsAppUrl(draft: { phone: string | null; text: string }): string {
  const text = encodeURIComponent(draft.text);
  if (!draft.phone) return `https://web.whatsapp.com/send?text=${text}`;
  const phone = draft.phone.replace(/\D+/gu, "").replace(/^0/u, "62");
  return `https://web.whatsapp.com/send?phone=${phone}&text=${text}`;
}
