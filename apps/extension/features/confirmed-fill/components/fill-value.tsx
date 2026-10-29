import { NemuButton } from "@nemu/ui/nemu/nemu-button";

import type { PendingFill } from "../hooks/use-confirmed-fill";

/**
 * The Answer Card's Isi strip for a confirmed `fill` step: the value on a nemu-subtle strip with
 * a solid Isi button at its right end, in place of Salin. Nemu writes the value only on the press.
 */
export function FillValue({ fill }: { fill: PendingFill }) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-nemu-subtle py-1.5 pr-1.5 pl-3">
      <span className="min-w-0 flex-1 font-medium">{fill.value}</span>
      {/* The hook offers this only when the label names the value it writes. */}
      <NemuButton tone="solid" size="xs" aria-label={fill.action.label} onClick={fill.confirm}>
        Isi
      </NemuButton>
    </div>
  );
}
