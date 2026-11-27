import type { Procedure } from "@nemu/contracts/school";

/**
 * F3-02 review edits (#214), kept pure: deleting a step renumbers the rest and drops a parameter
 * no step uses any more; renaming an input changes its label and the question Nemu asks.
 */
export function deleteStep(procedure: Procedure, stepId: string): Procedure {
  const steps = procedure.steps
    .filter((step) => step.id !== stepId)
    .map((step, index) => ({ ...step, order: index + 1, id: `step-${index + 1}` }));
  const used = new Set(
    steps.flatMap((step) =>
      [...(step.valueTemplate ?? "").matchAll(/\{\{\s*([a-z0-9_]+)\s*\}\}/gu)].map((m) => m[1]),
    ),
  );
  return {
    ...procedure,
    steps,
    parameters: procedure.parameters.filter((parameter) => used.has(parameter.name)),
  };
}

export function renameParameter(
  procedure: Procedure,
  name: string,
  changes: { label?: string; question?: string },
): Procedure {
  return {
    ...procedure,
    parameters: procedure.parameters.map((parameter) =>
      parameter.name === name ? { ...parameter, ...changes } : parameter,
    ),
  };
}

/** "{{murid}}" → "Murid" (the input's label), for the step list. */
export function valueText(procedure: Procedure, template: string | null): string | null {
  if (template === null) return null;
  return template.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gu, (_, name: string) => {
    const parameter = procedure.parameters.find((item) => item.name === name);
    return parameter ? `‹${parameter.label}›` : name;
  });
}
