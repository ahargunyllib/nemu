import type { Calculation } from "@nemu/contracts";

import { describeCalculation } from "../lib/calculation";

export function CalculationBreakdown({ calculations }: { calculations: readonly Calculation[] }) {
  if (!calculations.length) return null;

  return (
    <section aria-label="Perhitungan" className="flex flex-col gap-1.5">
      {calculations.map((calculation, index) => {
        const line = describeCalculation(calculation);
        return (
          <div key={`${calculation.fungsi}-${index}`} className="bg-muted px-2 py-1.5">
            <p className="font-medium">{line.title}</p>
            <p>
              {line.formula} = <strong>{line.result}</strong>
            </p>
            {line.source && <p className="text-muted-foreground">{line.source}</p>}
          </div>
        );
      })}
    </section>
  );
}
