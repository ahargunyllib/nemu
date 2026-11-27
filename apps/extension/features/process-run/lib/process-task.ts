import { isDeniedActionName, normalizeControlName } from "@nemu/ai/school/safety";
import type { ExecutorStep, ExecutorTarget, ExecutorTask } from "@nemu/contracts/executor";
import type { BpmnPlan, FormTableRow, ProcessPlanTask } from "@nemu/contracts/school";

import { accessibleName, findTarget, isVisible } from "../../executor/lib/find-target";
import { addressFor } from "../../grade-photo/lib/grade-task";

/**
 * F3 (#213): a BPMN plan's steps for one teacher task, as an executor task. Nothing here knows
 * any one process: the page path comes from the plan (task link, WS-04 or a recording, F3-19),
 * each field is found by the label the page shows for it (F3-17), repeating fields go into the
 * page table by the row's name and the column's header, and the run ends pointing at the button
 * only the teacher presses. Pages differ, so the steps come in parts (a step source): after each
 * menu click Nemu fills what that page shows, then opens the next one.
 */

/** Every F3 run is this kind, so Catatan langkah and its finisher find it. */
export const PROCESS_TASK_KIND = "f3-proses";

export type HeaderFill = { fieldId: string; label: string; value: string };
export type RowsFill = {
  keyField: string | null;
  columns: Array<{ fieldId: string; label: string }>;
  rows: FormTableRow[];
};

/** What the step source still has to do; kept with the run, so it survives a page load. */
export type ProcessContinuation = {
  /** Menu items still to open, in order. */
  segments: string[];
  /** Single fields not filled yet (Kelas, Tanggal setoran); each when its page shows it. */
  header: HeaderFill[];
  rows: RowsFill | null;
  /** The button only the teacher presses ("Simpan setoran"). */
  action: string;
  sentence: string;
  ringkasan: string;
};

export type LabelMatcher = (
  fields: Array<{ id: string; label: string }>,
  pageLabels: string[],
) => Promise<Record<string, string | null>>;

/** "Al-Quran › Setoran baru" → ["Al-Quran", "Setoran baru"]. */
export function pagePath(page: string): string[] {
  return page
    .split(/\s*(?:›|»|>|\/)\s*/u)
    .map((segment) => segment.trim())
    .filter(Boolean);
}

/** "Aisyah Putri Wijaya: An-Naba', dari ayat 1, …": the values behind Lihat ringkasan. */
export function rowsSummary(rows: RowsFill | null): string {
  if (!rows) return "";
  return rows.rows
    .map((row) => {
      const values = rows.columns
        .filter((column) => row.values[column.fieldId])
        .map((column) => `${column.label} ${row.values[column.fieldId]}`);
      return `${row.name}: ${values.join(", ")}`;
    })
    .join("; ");
}

/** True when the plan has a page for every teacher task, so Nemu can do it, not just explain. */
export function canRun(plan: Pick<BpmnPlan, "tasks">): boolean {
  return plan.tasks.length > 0 && plan.tasks.every((task) => task.page);
}

/** The executor task for one teacher task of the plan, and where its step source starts. */
export function processTask(input: {
  plan: BpmnPlan;
  task: ProcessPlanTask;
  honorific: string;
  source: string;
}): { task: ExecutorTask; continuation: ProcessContinuation } {
  const { plan, task } = input;
  const mine = plan.steps.filter((step) => step.taskId === task.taskId);
  const header: HeaderFill[] = mine.flatMap((step) => (step.kind === "fill" ? step.fields : []));
  const rowsStep = mine.find((step) => step.kind === "rows");
  const rows: RowsFill | null =
    rowsStep?.kind === "rows"
      ? { keyField: rowsStep.keyField, columns: rowsStep.columns, rows: rowsStep.rows }
      : null;
  const human = mine.find((step) => step.kind === "human");
  const action = human?.kind === "human" ? human.action : task.action;
  const [first, ...rest] = pagePath(task.page ?? "");
  const continuation: ProcessContinuation = {
    segments: rest,
    header,
    rows,
    action,
    sentence: `Silakan ${addressFor(input.honorific)} tekan ${action}.`,
    ringkasan: rowsSummary(rows),
  };
  const steps: ExecutorStep[] = first ? [{ verb: "clickMenu", target: { text: first } }] : [];
  return {
    task: {
      kind: PROCESS_TASK_KIND,
      title: `${plan.processName}: ${task.name}`,
      source: input.source,
      steps,
    },
    continuation,
  };
}

// --- Reading the page ----------------------------------------------------------------------------

const FIELD_SELECTOR =
  "input:not([type=hidden]):not([type=password]):not([type=button]):not([type=submit]):not([type=reset]), select, textarea, [role=combobox], [role=textbox]";

function textOf(element: Element): string {
  return (element.textContent ?? "").replace(/\s+/gu, " ").trim();
}

/** A field in a table body row is a row's cell, not a field of the form itself. */
function inTableRow(element: Element): boolean {
  const row = element.closest("tr, [role=row]");
  return !!row && !!row.querySelector("td, [role=cell], [role=gridcell]");
}

/** What the page shows now: the form's own field labels, and the column headers of its tables. */
export function readPageLabels(doc: Document): { fields: string[]; columns: string[] } {
  const fields = new Set<string>();
  for (const element of doc.querySelectorAll(FIELD_SELECTOR)) {
    if (element.closest("nemu-overlay") || !isVisible(element) || inTableRow(element)) continue;
    const name = accessibleName(element);
    if (name) fields.add(name);
  }
  const columns = new Set<string>();
  for (const header of doc.querySelectorAll("th, [role=columnheader]")) {
    if (!isVisible(header)) continue;
    const name = textOf(header);
    if (name) columns.add(name);
  }
  return { fields: [...fields], columns: [...columns] };
}

/** setValue or selectOption, from what the element is. */
function fillStep(element: Element | null, target: ExecutorTarget, value: string): ExecutorStep {
  const select =
    element instanceof HTMLSelectElement || element?.getAttribute("role") === "combobox";
  return select
    ? { verb: "selectOption", target: { ...target, role: "combobox" }, option: value }
    : { verb: "setValue", target: { ...target, role: "textbox" }, value };
}

function found(doc: Document, target: ExecutorTarget): Element | null {
  const lookup = findTarget(doc, target);
  return lookup.status === "found" ? lookup.element : null;
}

/** The button the task ends on, by its name; else the one button on the page only she presses. */
export function actionTarget(doc: Document, action: string): ExecutorTarget {
  const named: ExecutorTarget = { role: "button", text: action };
  if (found(doc, named)) return named;
  const denied = [...doc.querySelectorAll("button, input[type=submit], [role=button]")].filter(
    (element) =>
      !element.closest("nemu-overlay") &&
      isVisible(element) &&
      isDeniedActionName(accessibleName(element)),
  );
  return denied.length === 1 ? { role: "button", text: accessibleName(denied[0]!) } : named;
}

function anyVisible(doc: Document, targets: ExecutorTarget[]): boolean {
  return targets.some((target) => findTarget(doc, target).status === "found");
}

/** Waits until something the next part needs is on the page (a menu click draws it later). */
async function settle(doc: Document, targets: ExecutorTarget[], timeoutMs: number) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until && !anyVisible(doc, targets)) {
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
}

/**
 * The step source: fill the single fields this page shows, then open the next menu item; on the
 * last page fill the rest, the table rows, and point at the teacher's button.
 */
export async function nextProcessSteps(
  doc: Document,
  continuation: ProcessContinuation,
  match: LabelMatcher,
  timeoutMs = 4000,
): Promise<{ steps: ExecutorStep[]; continuation: ProcessContinuation | null }> {
  const [next, ...later] = continuation.segments;
  const lastPage = next === undefined;
  await settle(
    doc,
    [
      ...continuation.header.map((field) => ({ label: field.label })),
      ...(next ? [{ text: next }] : [{ role: "button" as const, text: continuation.action }]),
      ...(continuation.rows?.rows[0] ? [{ row: continuation.rows.rows[0].name }] : []),
    ],
    timeoutMs,
  );
  const labels = readPageLabels(doc);
  const names = await match(
    [
      ...continuation.header.map((field) => ({ id: field.fieldId, label: field.label })),
      ...(lastPage
        ? (continuation.rows?.columns ?? []).map((column) => ({
            id: `kolom:${column.fieldId}`,
            label: column.label,
          }))
        : []),
    ],
    [...labels.fields, ...(lastPage ? labels.columns : [])],
  );

  const steps: ExecutorStep[] = [];
  const pending: HeaderFill[] = [];
  for (const field of continuation.header) {
    const label = names[field.fieldId];
    const target: ExecutorTarget = { label: label ?? field.label };
    const element = found(doc, target);
    // Not on this page yet: it waits for a later one, unless this is the last page.
    if (!element && !lastPage) {
      pending.push(field);
      continue;
    }
    steps.push(fillStep(element, target, field.value));
  }

  if (!lastPage) {
    steps.push({ verb: "clickMenu", target: { text: next } });
    return { steps, continuation: { ...continuation, segments: later, header: pending } };
  }

  const rows = continuation.rows;
  for (const row of rows?.rows ?? []) {
    // A form with one person per page (no table row for the name) is filled by label.
    const onPage = rowsNamed(doc, row.name).some(({ row: tr }) =>
      tr.querySelector("input, select, textarea, [role=combobox], [role=textbox]"),
    );
    for (const column of rows!.columns) {
      const value = row.values[column.fieldId];
      if (!value) continue;
      const label = names[`kolom:${column.fieldId}`] ?? column.label;
      const target: ExecutorTarget = onPage ? { row: row.name, column: label } : { label };
      const element = onPage ? cellControl(doc, row.name, label) : found(doc, target);
      const step = fillStep(element, target, value);
      steps.push(step.verb === "setValue" ? { ...step, rowName: row.name } : step);
    }
  }
  steps.push({
    verb: "point",
    target: actionTarget(doc, continuation.action),
    sentence: continuation.sentence,
    ...(continuation.ringkasan ? { ringkasan: continuation.ringkasan.slice(0, 4000) } : {}),
  });
  return { steps, continuation: null };
}

/** The table rows whose own cell says `name` (a history table may list the name too). */
function rowsNamed(doc: Document, name: string): Array<{ cells: Element[]; row: Element }> {
  const wanted = normalizeControlName(name);
  return [...doc.querySelectorAll("tr, [role=row]")].flatMap((row) => {
    const cells = [
      ...row.querySelectorAll("td, th, [role=cell], [role=gridcell], [role=rowheader]"),
    ];
    return cells.some((cell) => normalizeControlName(textOf(cell)) === wanted)
      ? [{ cells, row }]
      : [];
  });
}

/** The field in the row's cell under the column, so a select is picked and an input typed. */
function cellControl(doc: Document, name: string, column: string): Element | null {
  const wanted = normalizeControlName(column);
  for (const { row, cells } of rowsNamed(doc, name)) {
    const table = row.closest("table, [role=table], [role=grid]");
    const headers = table ? [...table.querySelectorAll("th, [role=columnheader]")] : [];
    const index = headers.findIndex((cell) => normalizeControlName(textOf(cell)) === wanted);
    const control = cells[index]?.querySelector(
      "input, select, textarea, [role=combobox], [role=textbox]",
    );
    if (control) return control;
  }
  return null;
}
