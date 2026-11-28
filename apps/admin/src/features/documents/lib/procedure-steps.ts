const PARAMETER = /\{\{([a-z][a-z0-9_]*)\}\}/gu;

/** The parameters a step's value is made of: "{{kelas}}" → ["kelas"]. */
export function stepParameters(valueTemplate: string | null): string[] {
  return valueTemplate ? [...valueTemplate.matchAll(PARAMETER)].map((match) => match[1]!) : [];
}
