import { Badge } from "@nemu/ui/components/badge";
import { Button } from "@nemu/ui/components/button";
import { TriangleAlertIcon } from "lucide-react";

import type { ConfirmedFillControlModel } from "../hooks/use-confirmed-fill";

export function ConfirmedFillControl({ control }: { control: ConfirmedFillControlModel }) {
  const style = {
    left: control.box.left,
    top: control.box.top + control.box.height + 8,
  };

  if (control.mode === "mismatch") {
    return (
      <Badge className="pointer-events-auto absolute" variant="destructive" style={style}>
        <TriangleAlertIcon data-icon="inline-start" />
        {control.message}
      </Badge>
    );
  }

  return (
    <Button
      className="pointer-events-auto absolute"
      size="sm"
      variant="default"
      style={style}
      onClick={control.confirm}
    >
      {control.action.label}
    </Button>
  );
}
