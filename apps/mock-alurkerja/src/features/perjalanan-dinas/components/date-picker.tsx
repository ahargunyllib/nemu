import { Button } from "@nemu/ui/components/button";
import { Calendar } from "@nemu/ui/components/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@nemu/ui/components/popover";
import { useState } from "react";
import { id as localeId } from "react-day-picker/locale";

import {
  formatHariTanggal,
  fromIsoDate,
  toIsoDate,
} from "@/features/perjalanan-dinas/lib/perdin-form";

/**
 * A YYYY-MM-DD date picked from an Indonesian calendar ("Oktober 2026"); `notBefore` greys out the
 * days before it.
 */
export default function DatePicker({
  id,
  nemuId,
  value,
  notBefore,
  invalid,
  onChange,
}: {
  id: string;
  nemuId: string;
  value: string;
  notBefore?: string;
  invalid: boolean;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = value ? fromIsoDate(value) : undefined;
  const earliest = notBefore ? fromIsoDate(notBefore) : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        id={id}
        data-nemu-id={nemuId}
        aria-invalid={invalid}
        render={<Button variant="outline" className="w-full justify-start font-normal" />}
      >
        {value ? (
          formatHariTanggal(value)
        ) : (
          <span className="text-muted-foreground">Pilih tanggal</span>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          locale={localeId}
          selected={selected}
          defaultMonth={selected ?? earliest}
          disabled={earliest && { before: earliest }}
          onSelect={(date) => {
            onChange(date ? toIsoDate(date) : "");
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
