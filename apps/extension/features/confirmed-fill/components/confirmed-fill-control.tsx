import { NemuBadge } from "@nemu/ui/nemu/nemu-badge";
import { NemuButton } from "@nemu/ui/nemu/nemu-button";
import { TriangleAlertIcon } from "lucide-react";

import type { ConfirmedFillControlModel } from "../hooks/use-confirmed-fill";

export function ConfirmedFillControl({ control }: { control: ConfirmedFillControlModel }) {
  const style = {
    left: control.box.left,
    top: control.box.top + control.box.height + 8,
  };

  if (control.mode === "mismatch") {
    return (
      <NemuBadge
        tone="danger"
        className="pointer-events-auto absolute shadow-nemu-float"
        style={style}
      >
        <TriangleAlertIcon data-icon="inline-start" />
        {control.message}
      </NemuBadge>
    );
  }

  // The hook offers this only when the label names the value it writes.
  return (
    <NemuButton
      tone="outline"
      size="sm"
      className="pointer-events-auto absolute bg-background shadow-nemu-float"
      style={style}
      onClick={control.confirm}
    >
      {control.action.label}
    </NemuButton>
  );
}
