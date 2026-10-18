import { Button } from "@nemu/ui/components/button";
import { CheckIcon, CopyIcon } from "lucide-react";
import { useEffect, useState } from "react";

/** How long "Tersalin" shows after a copy before the button reads "Salin" again. */
const COPIED_MS = 2_000;

/**
 * The value a step asks for, bold on a nemu-subtle strip, with a Salin button that copies it, so
 * Rina pastes it into the field herself: Nemu never fills a field.
 */
export function ValueStrip({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), COPIED_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch (error) {
      console.warn("[nemu] Copying the value failed", error);
    }
  }

  return (
    <div className="flex items-center gap-2 rounded-xl bg-nemu-subtle py-1.5 pr-1.5 pl-3 text-nemu-subtle-foreground">
      <span className="min-w-0 flex-1 truncate text-[14px]/[18px] font-bold">{value}</span>
      <Button
        size="xs"
        variant="ghost"
        className="text-nemu-text hover:bg-nemu-amber-100 hover:text-nemu-text"
        onClick={() => void copy()}
      >
        {copied ? <CheckIcon data-icon="inline-start" /> : <CopyIcon data-icon="inline-start" />}
        {copied ? "Tersalin" : "Salin"}
      </Button>
    </div>
  );
}
