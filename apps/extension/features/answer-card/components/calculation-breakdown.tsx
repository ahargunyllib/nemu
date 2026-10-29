import type { Calculation } from "@nemu/contracts";

import { describeCalculation } from "../lib/calculation";
import { CALC } from "../lib/typography";

/**
 * Each calculation as its formula line: "30% × Rp745.000 × 2 malam = Rp447.000". With several,
 * each line starts with what it computes, so they can be told apart.
 */
export function CalculationBreakdown({ calculations }: { calculations: readonly Calculation[] }) {
  if (!calculations.length) return null;
  const titled = calculations.length > 1;

  return (
    <section aria-label="Perhitungan" className={`flex flex-col gap-1 ${CALC}`}>
      {calculations.map((calculation, index) => {
        const line = describeCalculation(calculation);
        return (
          <p key={`${calculation.fungsi}-${index}`}>
            {titled && `${line.title}: `}
            {line.formula} = {line.result}
          </p>
        );
      })}
    </section>
  );
}
