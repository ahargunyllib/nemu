import type { Calculation } from "@nemu/contracts";

import { describeCalculation } from "../lib/calculation";

/** Each calculation as one plain sentence: "Lumpsum penginapan: 30% × Rp745.000 × 2 malam = Rp447.000." */
export function CalculationBreakdown({ calculations }: { calculations: readonly Calculation[] }) {
  if (!calculations.length) return null;

  return (
    <section aria-label="Perhitungan" className="flex flex-col gap-1">
      {calculations.map((calculation, index) => {
        const line = describeCalculation(calculation);
        return (
          <p key={`${calculation.fungsi}-${index}`}>
            {line.title}: {line.formula} = {line.result}.
          </p>
        );
      })}
    </section>
  );
}
