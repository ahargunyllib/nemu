import { evaluate as evaluateFeel } from "@bpmn-io/feelin";
import jexl from "jexl";

import type { ProcessFlow } from "./graph.js";

/**
 * Deterministic gateway conditions (no eval, Workers-safe). Camunda 7 JUEL `${…}` is translated to
 * Jexl; FEEL goes to feelin. A condition that reads a variable the teacher hasn't given yet returns
 * "missing" so Nemu asks one question instead of guessing a branch.
 */

export type SlotValue = string | number | boolean | null;
export type Slots = Readonly<Record<string, SlotValue | undefined>>;

export type ConditionResult = { result: boolean } | { missing: string[] } | { unsupported: string };

const KEYWORDS = new Set([
  "true",
  "false",
  "null",
  "and",
  "or",
  "not",
  "eq",
  "ne",
  "gt",
  "lt",
  "ge",
  "le",
  "empty",
  "in",
  "div",
  "mod",
]);

/** Identifiers outside string literals. */
export function conditionVariables(body: string): string[] {
  const withoutStrings = body.replace(/'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"/gu, " ");
  const found = withoutStrings.match(/[A-Za-z_][A-Za-z0-9_]*/gu) ?? [];
  return [...new Set(found.filter((name) => !KEYWORDS.has(name)))];
}

export function juelToJexl(body: string): string {
  let expression = body.trim();
  const wrapped = expression.match(/^[$#]\{([\s\S]*)\}$/u);
  if (wrapped) expression = wrapped[1]!;
  return expression
    .replace(/\.equals\(\s*('(?:[^']*)'|"(?:[^"]*)")\s*\)/gu, " == $1")
    .replace(/\beq\b/gu, "==")
    .replace(/\bne\b/gu, "!=")
    .replace(/\bgt\b/gu, ">")
    .replace(/\blt\b/gu, "<")
    .replace(/\bge\b/gu, ">=")
    .replace(/\ble\b/gu, "<=")
    .replace(/\band\b/gu, "&&")
    .replace(/\bor\b/gu, "||")
    .replace(/\bnot\b/gu, "!")
    .trim();
}

export function evaluateCondition(
  condition: NonNullable<ProcessFlow["condition"]>,
  slots: Slots,
): ConditionResult {
  if (condition.language === "label") return { unsupported: condition.body };
  const body = condition.language === "juel" ? juelToJexl(condition.body) : condition.body;
  const variables = conditionVariables(body);
  const missing = variables.filter((name) => slots[name] === undefined || slots[name] === null);
  if (missing.length) return { missing };

  const context: Record<string, SlotValue> = {};
  for (const name of variables) context[name] = slots[name] ?? null;
  try {
    if (condition.language === "feel") {
      const { value } = evaluateFeel(body, context);
      return { result: value === true };
    }
    return { result: jexl.evalSync(body, context) === true };
  } catch (error) {
    return { unsupported: error instanceof Error ? error.message : String(error) };
  }
}
