import { useId } from "react";

/**
 * A short numbered list of steps (`docs/design-system.md`, "Steps"): each led by a 30 px circle
 * with its number in Nemu's amber, under an optional small label that also names the list for
 * screen readers. Kartu Info's list ("Catatan langkah · Cara catat setoran") and a start card's
 * steps (Kartu Pilih, "Mulai dari foto ini, Ibu?") share it.
 */
export function NemuSteps({ items, label }: { items: readonly string[]; label?: string }) {
  const labelId = useId();
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <p id={labelId} className="text-base leading-5 font-semibold text-nemu-secondary">
          {label}
        </p>
      )}
      <ol aria-labelledby={label ? labelId : undefined} className="flex flex-col">
        {items.map((item, index) => (
          <li key={item} className="flex items-start gap-3 py-1 text-xl leading-7">
            <span
              aria-hidden
              data-nemu-step
              className="flex size-[30px] shrink-0 items-center justify-center rounded-full border border-nemu-amber-200 bg-nemu-subtle text-[15px] leading-5 font-bold text-nemu-strong"
            >
              {index + 1}
            </span>
            <span className="pt-px">{item}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
