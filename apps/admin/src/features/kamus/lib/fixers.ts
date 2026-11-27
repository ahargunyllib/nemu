/** Who fixes a kamus error, in the words the operator reads. */
export const FIXERS = [
  { value: "guru", label: "Guru sendiri" },
  { value: "operator", label: "Operator sekolah" },
  { value: "kepsek", label: "Kepala sekolah" },
  { value: "keuangan", label: "Bagian keuangan" },
  { value: "dinas", label: "Dinas pendidikan" },
] as const;

export type Fixer = (typeof FIXERS)[number]["value"];

export function fixerLabel(fixer: Fixer): string {
  return FIXERS.find((option) => option.value === fixer)?.label ?? fixer;
}
