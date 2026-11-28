import type { GradeEntry, GradeRulesResult, SchoolRuleKey } from "@nemu/contracts/school";

/**
 * School rules applied in code (ADR-0005), each citing its Rule Source (ADR-0007). A rule whose
 * source isn't active in the workspace stops the step instead of applying an uncited rule.
 */

export type SchoolGradeConfig = {
  /** Kriteria Ketuntasan Minimal (SOP Penilaian 3.2). */
  kkm: number;
};

export type SchoolRuleCitations = Readonly<Partial<Record<SchoolRuleKey, string>>>;

const REQUIRED_RULES: readonly SchoolRuleKey[] = ["school.kkm", "school.absence_blank"];

export function applySchoolRules(
  column: string,
  entries: readonly GradeEntry[],
  config: SchoolGradeConfig,
  citations: SchoolRuleCitations,
): GradeRulesResult {
  const missing = REQUIRED_RULES.filter((key) => !citations[key]);
  if (missing.length) {
    return {
      status: "needs_source",
      missing,
      sentence: "SOP Penilaian sekolah belum diunggah ke Nemu.",
    };
  }

  const ruled = entries.map((entry) => {
    const graded = entry.status === "value" && entry.value !== null;
    return {
      ...entry,
      value: graded ? entry.value : null,
      remedial: graded ? entry.value! < config.kkm : false,
    };
  });
  const filled = ruled.filter((entry) => entry.status === "value").length;
  const blank = ruled.length - filled;
  const remedial = ruled.filter((entry) => entry.remedial).length;

  const parts = [`${filled} nilai terisi`];
  if (blank) parts.push(`${blank} dikosongkan`);
  if (remedial) parts.push(`${remedial} remedial (di bawah KKM ${config.kkm})`);

  const usedCitations: Record<string, string> = {};
  for (const key of ["school.kkm", "school.absence_blank"] as const)
    usedCitations[key] = citations[key]!;
  return {
    status: "ok",
    column,
    entries: ruled,
    summary: { filled, blank, remedial },
    citations: usedCitations,
    summarySentence: `${parts.join(", ")}.`,
    kkm: config.kkm,
  };
}
