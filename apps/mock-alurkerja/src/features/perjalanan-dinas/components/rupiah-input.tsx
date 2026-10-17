import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@nemu/ui/components/input-group";
import type { ComponentProps } from "react";

export default function RupiahInput(props: ComponentProps<typeof InputGroupInput>) {
  return (
    <InputGroup>
      <InputGroupAddon>
        <InputGroupText>Rp</InputGroupText>
      </InputGroupAddon>
      <InputGroupInput inputMode="numeric" autoComplete="off" {...props} />
    </InputGroup>
  );
}
