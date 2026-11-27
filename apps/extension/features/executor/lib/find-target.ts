import { normalizeControlName } from "@nemu/ai/school/safety";
import type { ExecutorTarget, TargetRole } from "@nemu/contracts/executor";

/** The elements each role covers, native and ARIA alike. Password fields are never a target. */
const ROLE_SELECTORS: Record<TargetRole, string> = {
  textbox: [
    "input:not([type])",
    "input[type=text]",
    "input[type=number]",
    "input[type=email]",
    "input[type=tel]",
    "input[type=date]",
    "input[type=search]",
    "input[type=url]",
    "textarea",
    "[role=textbox]",
    "[contenteditable=true]",
  ].join(", "),
  combobox: "select, [role=combobox], [role=listbox]",
  checkbox: "input[type=checkbox], [role=checkbox], [role=switch]",
  radio: "input[type=radio], [role=radio]",
  button:
    "button, input[type=button], input[type=submit], input[type=reset], [role=button], summary",
  link: "a[href], [role=link]",
  menuitem: "[role=menuitem], [role=menuitemradio], [role=menuitemcheckbox], [role=option]",
  tab: "[role=tab]",
};

const ANY_ROLE = Object.values(ROLE_SELECTORS).join(", ");

const ROW_CELLS = "td, th, [role=cell], [role=gridcell], [role=rowheader], [role=columnheader]";

function textOf(element: Element | null | undefined): string {
  return (element?.textContent ?? "").replace(/\s+/gu, " ").trim();
}

/**
 * What a screen reader would call the element: aria-labelledby, aria-label, its <label>, then
 * placeholder or title for fields, or the text it shows for buttons and links.
 */
export function accessibleName(element: Element): string {
  const labelledBy = element.getAttribute("aria-labelledby");
  if (labelledBy) {
    const doc = element.ownerDocument;
    const name = labelledBy
      .split(/\s+/u)
      .map((id) => textOf(doc.getElementById(id)))
      .join(" ")
      .trim();
    if (name) return name;
  }
  const ariaLabel = element.getAttribute("aria-label")?.trim();
  if (ariaLabel) return ariaLabel;
  if ("labels" in element) {
    const labels = (element as HTMLInputElement).labels;
    const name = labels ? [...labels].map(textOf).join(" ").trim() : "";
    if (name) return name;
  }
  if (element instanceof HTMLInputElement && ["button", "submit", "reset"].includes(element.type))
    return element.value.trim();
  const text = textOf(element);
  if (text && !(element instanceof HTMLSelectElement)) return text;
  return (element.getAttribute("placeholder") ?? element.getAttribute("title") ?? "").trim();
}

/** Visible on screen: not hidden by an attribute, a closed dialog or CSS. */
export function isVisible(element: Element): boolean {
  if (element.closest("[hidden], [aria-hidden='true'], dialog:not([open])")) return false;
  if ("checkVisibility" in element && typeof element.checkVisibility === "function")
    return element.checkVisibility({ visibilityProperty: true });
  return true;
}

function isPassword(element: Element): boolean {
  return element instanceof HTMLInputElement && element.type === "password";
}

/** The cells of the table row whose own cell says `row`, at `column` when one is named. */
function cellsFor(doc: Document, row: string, column: string | undefined): Element[] {
  const wanted = normalizeControlName(row);
  const rows = [...doc.querySelectorAll("tr, [role=row]")].filter((tr) =>
    [...tr.querySelectorAll(ROW_CELLS)].some(
      (cell) => normalizeControlName(textOf(cell)) === wanted,
    ),
  );
  if (!column) return rows;
  const header = normalizeControlName(column);
  return rows.flatMap((tr) => {
    const table = tr.closest("table, [role=table], [role=grid]");
    const headers = table ? [...table.querySelectorAll("th, [role=columnheader]")] : [];
    const index = headers.findIndex((cell) => normalizeControlName(textOf(cell)) === header);
    const cell = index >= 0 ? tr.querySelectorAll(ROW_CELLS)[index] : undefined;
    return cell ? [cell] : [];
  });
}

/**
 * `near`: of several matches, the ones closest to the text, i.e. whose nearest ancestor that shows
 * it is the smallest. An "Edit" menu inside an activity card beats one in the section around it.
 */
function nearest(matches: Element[], near: string): Element[] {
  const wanted = normalizeControlName(near);
  const reach = (element: Element): number => {
    for (let scope: Element | null = element; scope; scope = scope.parentElement) {
      const text = normalizeControlName(textOf(scope));
      if (` ${text} `.includes(` ${wanted} `)) return text.length;
    }
    return Number.POSITIVE_INFINITY;
  };
  const scored = matches.map((element) => ({ element, reach: reach(element) }));
  const best = Math.min(...scored.map(({ reach }) => reach));
  if (!Number.isFinite(best)) return [];
  return scored.filter(({ reach }) => reach === best).map(({ element }) => element);
}

/** The fieldsets (by legend) and ARIA groups (by name) called `group`. */
function groupsNamed(doc: Document, group: string): Element[] {
  const wanted = normalizeControlName(group);
  return [...doc.querySelectorAll("fieldset, [role=group], [role=radiogroup]")].filter(
    (element) => {
      const legend =
        element instanceof HTMLFieldSetElement ? element.querySelector(":scope > legend") : null;
      const name = legend ? textOf(legend) : accessibleName(element);
      return normalizeControlName(name) === wanted;
    },
  );
}

export type TargetLookup =
  | { status: "found"; element: Element; name: string }
  | { status: "missing" }
  | { status: "ambiguous"; count: number };

/**
 * Finds the one element a target names, by label, role and text, never by position (F0-06).
 * An exact name wins; a name that only contains the words counts when nothing matches exactly.
 * None, or more than one, is reported so the executor stops and asks.
 */
export function findTarget(doc: Document, target: ExecutorTarget): TargetLookup {
  const selector = target.role ? ROLE_SELECTORS[target.role] : ANY_ROLE;
  const scopes: (Document | Element)[] = target.row
    ? cellsFor(doc, target.row, target.column)
    : target.group
      ? groupsNamed(doc, target.group)
      : [doc];
  const candidates = [
    ...new Set(scopes.flatMap((scope) => [...scope.querySelectorAll(selector)])),
  ].filter((element) => isVisible(element) && !isPassword(element));

  const wanted = normalizeControlName(target.label ?? target.text ?? "");
  const named = (exact: boolean) =>
    candidates.filter((element) => {
      if (!wanted) return true;
      const names = [accessibleName(element), target.text ? textOf(element) : ""]
        .map(normalizeControlName)
        .filter(Boolean);
      return names.some((name) => (exact ? name === wanted : ` ${name} `.includes(` ${wanted} `)));
    });

  const exact = named(true);
  const byName = exact.length > 0 ? exact : named(false);
  const matches = target.near ? nearest(byName, target.near) : byName;
  if (matches.length === 0) return { status: "missing" };
  if (matches.length > 1) return { status: "ambiguous", count: matches.length };
  const [element] = matches as [Element];
  const own = accessibleName(element) || describeTarget({ ...target, group: undefined });
  return { status: "found", element, name: target.group ? `${own} (${target.group})` : own };
}

/** How Nemu names a target in a sentence: "Kelas", "Nilai di baris Budi Santoso". */
export function describeTarget(target: ExecutorTarget): string {
  const near = target.near ? ` di ${target.near}` : "";
  const within = target.group ? ` (${target.group})` : "";
  if (target.label) return `${target.label}${near}${within}`;
  if (target.text) return `${target.text}${near}${within}`;
  return `${target.column ?? "isian"} di baris ${target.row ?? ""}`.trim();
}
