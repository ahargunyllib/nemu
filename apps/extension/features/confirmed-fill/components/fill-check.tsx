import { Button } from "@nemu/ui/components/button";
import { NemuBadge } from "@nemu/ui/nemu/nemu-badge";
import { CheckIcon, TriangleAlertIcon } from "lucide-react";

import type { FillCheck as FillCheckModel } from "../hooks/use-confirmed-fill";

/** Room between the chip and the field's right edge. */
const INSET = 8;

/**
 * A chip at the right end of a field Rina filled with Isi: "Sesuai" while it holds the value, or
 * "Tidak sesuai hitungan Rp447.000 · Isi ulang" once she changed it, where Isi ulang fills it again.
 */
export function FillCheck({ check }: { check: FillCheckModel }) {
  const style = {
    left: check.box.left + check.box.width - INSET,
    top: check.box.top + check.box.height / 2,
  };
  const position = "pointer-events-auto absolute -translate-x-full -translate-y-1/2";

  // Keyed by state, so the chip swaps at once instead of fading between the two tones.
  if (check.matches) {
    return (
      <NemuBadge key="match" tone="success-subtle" className={position} style={style}>
        <CheckIcon data-icon="inline-start" />
        Sesuai
      </NemuBadge>
    );
  }

  return (
    <NemuBadge key="mismatch" tone="danger" className={position} style={style}>
      <TriangleAlertIcon data-icon="inline-start" />
      <span>Tidak sesuai hitungan {check.value}</span>
      <span aria-hidden>·</span>
      <Button
        variant="link"
        size="xs"
        className="h-auto p-0 text-[length:inherit] font-semibold text-inherit"
        onClick={check.refill}
      >
        Isi ulang
      </Button>
    </NemuBadge>
  );
}
