import type { PageElement } from "@nemu/contracts";

const CONFIRM_ACTION_PATTERN = /(?:^|\b)(kirim|submit)(?:\b|$)/iu;
const PROHIBITED_ACTION_PATTERN =
  /(?:^|\b)(setuju|setujui|approve|hapus|delete|bayar|pay)(?:\b|$)/iu;

function targetDescription(element: Pick<PageElement, "nemu_id" | "label">): string {
  return `${element.nemu_id} ${element.label}`;
}

export function isConfirmActionTarget(element: Pick<PageElement, "nemu_id" | "label">): boolean {
  return CONFIRM_ACTION_PATTERN.test(targetDescription(element));
}

export function isProhibitedActionTarget(element: Pick<PageElement, "nemu_id" | "label">): boolean {
  return PROHIBITED_ACTION_PATTERN.test(targetDescription(element));
}
