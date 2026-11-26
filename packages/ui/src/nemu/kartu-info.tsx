import { Button } from "@nemu/ui/components/button";
import { CardContent, CardFooter, CardHeader, CardTitle } from "@nemu/ui/components/card";
import type { KartuInfoProps } from "@nemu/ui/lib/nemu-display";
import { BIG_BUTTON, NemuCard } from "@nemu/ui/nemu/nemu-frame";
import { cn } from "cn";

/** Kartu Info: something to read. A title, a short list, and one [Tutup]. */
export function KartuInfo({ title, items, onClose }: KartuInfoProps) {
  return (
    <NemuCard display="info" label={title}>
      <CardHeader>
        <CardTitle className="text-xl leading-7 font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="flex list-disc flex-col gap-2 pl-6 text-xl leading-7">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </CardContent>
      <CardFooter>
        <Button type="button" onClick={onClose} className={cn(BIG_BUTTON, "w-full")}>
          Tutup
        </Button>
      </CardFooter>
    </NemuCard>
  );
}
