import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@nemu/ui/components/input-group";
import type { ComponentProps } from "react";

type RupiahInputProps = ComponentProps<typeof InputGroupInput> & {
  nemuId: string;
  /** The id of the field's label, which also names the whole group in the Element List. */
  labelId: string;
};

/**
 * A nominal field with an "Rp" prefix. The nemu_id sits on the whole group, prefix included,
 * so a highlight rings the field Rina sees rather than only its inner `<input>`.
 */
export default function RupiahInput({ nemuId, labelId, ...props }: RupiahInputProps) {
  return (
    <InputGroup data-nemu-id={nemuId} aria-labelledby={labelId}>
      <InputGroupAddon>
        <InputGroupText>Rp</InputGroupText>
      </InputGroupAddon>
      <InputGroupInput inputMode="numeric" autoComplete="off" {...props} />
    </InputGroup>
  );
}
