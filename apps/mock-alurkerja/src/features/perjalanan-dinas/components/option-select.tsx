import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@nemu/ui/components/select";

export default function OptionSelect({
  id,
  nemuId,
  options,
  placeholder,
  value,
  invalid,
  onChange,
}: {
  id: string;
  nemuId: string;
  options: readonly string[];
  placeholder: string;
  value: string;
  invalid: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <Select
      items={options.map((option) => ({ label: option, value: option }))}
      value={value || null}
      onValueChange={(next) => onChange(next ?? "")}
    >
      <SelectTrigger id={id} data-nemu-id={nemuId} aria-invalid={invalid} className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option} value={option}>
            {option}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
