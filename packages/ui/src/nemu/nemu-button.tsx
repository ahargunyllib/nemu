import { Button } from "@nemu/ui/components/button";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import type { ComponentProps } from "react";

/**
 * Nemu-branded looks layered on the stock shadcn Button, which stays untouched. The main action
 * in an Answer Card ("Lanjut", "Complete Task") is the stock default Button, not one of these.
 */
const nemuButtonVariants = cva("", {
  variants: {
    tone: {
      /** "Buka My Requests": amber outline pill. */
      outline:
        "border-nemu-ring bg-transparent text-nemu-text hover:bg-nemu-subtle hover:text-nemu-text",
      /** "Rincian", "Tutup", "Lihat detail": amber underlined text. */
      link: "h-auto px-0 text-nemu-text underline underline-offset-2 hover:text-nemu-amber-800",
      /** Icon buttons on a nemu fill, such as the Composer's crop and send. */
      soft: "bg-nemu-soft text-nemu-foreground hover:bg-nemu-foreground/30",
      /** The same button once it is the one to press: white with an amber glyph. */
      inverse: "bg-nemu-foreground text-nemu hover:bg-nemu-foreground/90",
    },
  },
});

type NemuButtonProps = Omit<ComponentProps<typeof Button>, "variant"> &
  Required<VariantProps<typeof nemuButtonVariants>>;

export function NemuButton({ tone, className, ...props }: NemuButtonProps) {
  const variant = tone === "outline" ? "outline" : tone === "link" ? "link" : "ghost";
  return (
    <Button variant={variant} className={cn(nemuButtonVariants({ tone }), className)} {...props} />
  );
}
