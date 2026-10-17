import { type PageElement, nemuIdSchema } from "@nemu/contracts";

export const MAX_ELEMENTS = 150;
export const MAX_PAYLOAD_BYTES = 50_000;
const MAX_LABEL_LENGTH = 200;
const MAX_ROLE_LENGTH = 80;

const INPUT_ROLES: Record<string, string> = {
  button: "button",
  checkbox: "checkbox",
  file: "button",
  image: "button",
  number: "spinbutton",
  radio: "radio",
  range: "slider",
  reset: "button",
  search: "searchbox",
  submit: "button",
};

/**
 * Builds the Element List sent with every prompt: each rendered element that carries a valid
 * `data-nemu-id`, on-screen ones first. Elements without one are skipped because the contract has
 * no selector fallback. Off-screen elements stay in with `visible: false`, so Nemu can scroll to
 * them. Labels never read what the user typed, and the list stays within 150 elements and 50 KB.
 */
export function collectElementList(root: ParentNode = document): PageElement[] {
  const seen = new Set<string>();
  const elements: PageElement[] = [];

  for (const element of root.querySelectorAll<HTMLElement>("[data-nemu-id]")) {
    const nemuId = element.dataset.nemuId;
    if (!nemuId || seen.has(nemuId) || !nemuIdSchema.safeParse(nemuId).success) continue;

    const box = element.getBoundingClientRect();
    if (!isRendered(element, box)) continue;
    seen.add(nemuId);

    elements.push({
      nemu_id: nemuId,
      label: accessibleLabel(element) || nemuId,
      role: elementRole(element).slice(0, MAX_ROLE_LENGTH),
      visible: isInViewport(box),
      position: {
        x: Math.round(box.left),
        y: Math.round(box.top),
        width: Math.round(box.width),
        height: Math.round(box.height),
      },
    });
  }

  elements.sort((a, b) => Number(b.visible) - Number(a.visible));
  return withinBudget(elements);
}

function isRendered(element: HTMLElement, box: DOMRect): boolean {
  if (box.width === 0 && box.height === 0) return false;
  return getComputedStyle(element).visibility !== "hidden";
}

function isInViewport(box: DOMRect): boolean {
  return (
    box.bottom > 0 && box.right > 0 && box.top < window.innerHeight && box.left < window.innerWidth
  );
}

function withinBudget(elements: PageElement[]): PageElement[] {
  const encoder = new TextEncoder();
  const kept: PageElement[] = [];
  let bytes = 2; // The array's brackets.

  for (const element of elements) {
    if (kept.length === MAX_ELEMENTS) break;
    const size = encoder.encode(JSON.stringify(element)).length + 1; // Plus its comma.
    if (bytes + size > MAX_PAYLOAD_BYTES) break;
    kept.push(element);
    bytes += size;
  }
  return kept;
}

function elementRole(element: HTMLElement): string {
  const explicit = element.getAttribute("role")?.trim().split(/\s+/u)[0];
  if (explicit) return explicit;

  switch (element.tagName.toLowerCase()) {
    case "a":
      return element.hasAttribute("href") ? "link" : "generic";
    case "button":
    case "summary":
      return "button";
    case "input":
      return INPUT_ROLES[(element.getAttribute("type") ?? "text").toLowerCase()] ?? "textbox";
    case "option":
      return "option";
    case "select":
      return "combobox";
    case "textarea":
      return "textbox";
    default:
      return "generic";
  }
}

/** The element's name from ARIA, its `<label>`, or its own text; a form control's value is never read. */
function accessibleLabel(element: HTMLElement): string {
  const candidates = [
    element.getAttribute("aria-label"),
    labelledByText(element),
    isFormControl(element) ? controlLabelText(element) : textOf(element),
    element.getAttribute("placeholder"),
    element.getAttribute("title"),
  ];
  for (const candidate of candidates) {
    const label = candidate?.replace(/\s+/gu, " ").trim();
    if (label) return label.slice(0, MAX_LABEL_LENGTH);
  }
  return "";
}

function isFormControl(
  element: HTMLElement,
): element is HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement {
  return (
    element instanceof HTMLInputElement ||
    element instanceof HTMLSelectElement ||
    element instanceof HTMLTextAreaElement
  );
}

function controlLabelText(element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement) {
  return Array.from(element.labels ?? [], textOf).join(" ");
}

function labelledByText(element: HTMLElement): string | undefined {
  const ids = element.getAttribute("aria-labelledby")?.split(/\s+/u) ?? [];
  return ids
    .map((id) => element.ownerDocument.getElementById(id))
    .map((labelElement) => (labelElement ? textOf(labelElement) : ""))
    .join(" ");
}

/** Text nodes only, skipping `<textarea>` and `<select>` so typed or chosen values stay out. */
function textOf(element: Element): string {
  const walker = element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const parts: string[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const control = node.parentElement?.closest("textarea, select, script, style");
    if (control && element.contains(control)) continue;
    parts.push(node.textContent ?? "");
  }
  return parts.join("");
}
