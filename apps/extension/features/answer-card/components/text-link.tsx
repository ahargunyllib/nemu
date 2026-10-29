import { cn } from "@nemu/ui/lib/utils";
import { NemuButton } from "@nemu/ui/nemu/nemu-button";

type TextLinkProps = Omit<React.ComponentProps<typeof NemuButton>, "tone" | "size">;

/** A Nemu link that sits in a line of card text, at the text's own size: "Rincian", "Coba lagi". */
export function TextLink({ className, ...props }: TextLinkProps) {
  return (
    <NemuButton
      tone="link"
      className={cn(
        "inline h-auto rounded-sm p-0 text-left align-baseline text-[length:inherit] leading-[inherit] font-normal whitespace-normal",
        className,
      )}
      {...props}
    />
  );
}
