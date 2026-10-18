import type { Calculation } from "@nemu/contracts";

import { describeCalculation } from "../lib/calculation";
import { CAPTION, LABEL_CAPS } from "../lib/typography";

/** Each calculation as a muted box: the formula over its bold result, then where the rate came from. */
export function CalculationBreakdown({ calculations }: { calculations: readonly Calculation[] }) {
  if (!calculations.length) return null;

  return (
    <section aria-label="Perhitungan" className="flex flex-col gap-1.5">
      {calculations.map((calculation, index) => {
        const line = describeCalculation(calculation);
        return (
          <div
            key={`${calculation.fungsi}-${index}`}
            className="flex flex-col gap-0.5 rounded-xl border bg-muted px-3 py-2"
          >
            <p className={`text-muted-foreground ${LABEL_CAPS}`}>{line.title}</p>
            <p className="text-[11.5px]/[16px] font-medium text-muted-foreground">{line.formula}</p>
            <p className="text-[14px]/[18px] font-bold">{line.result}</p>
            {line.source && <p className={`text-muted-foreground ${CAPTION}`}>{line.source}</p>}
          </div>
        );
      })}
    </section>
  );
}
