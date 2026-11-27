import { useElementRect } from "@nemu/ui/hooks/use-element-rect";
import { Check } from "lucide-react";

/** Cara 1 and 2: a small green tick at the right end of each field Nemu filled or checked. */
export function RowTicks({ elements }: { elements: readonly Element[] }) {
  return (
    <>
      {elements.map((element, index) => (
        <RowTick key={index} element={element} />
      ))}
    </>
  );
}

const TICK_SIZE = 20;

function RowTick({ element }: { element: Element }) {
  const rect = useElementRect(element);
  if (!rect || rect.width === 0) return null;
  return (
    <span
      role="img"
      aria-label="Sudah diisi"
      data-nemu-tick
      className="pointer-events-none fixed flex items-center justify-center rounded-full bg-nemu-success text-white shadow-nemu-float"
      style={{
        width: TICK_SIZE,
        height: TICK_SIZE,
        left: rect.left + rect.width + 4,
        top: rect.top + (rect.height - TICK_SIZE) / 2,
      }}
    >
      <Check aria-hidden className="size-3.5" strokeWidth={3} />
    </span>
  );
}
