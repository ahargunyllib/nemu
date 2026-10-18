import { Button } from "@nemu/ui/components/button";
import { CopyIcon } from "lucide-react";
import { useEffect, useState } from "react";

import type { CopyableValue } from "../lib/calculation";

/** How long "Tersalin" shows after a copy. */
const COPIED_MS = 1_500;

/** Salin nilai: the computed value on a nemu-subtle strip, copied as the form field takes it. */
export function CopyValue({ value }: { value: CopyableValue }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timeout = setTimeout(() => setCopied(false), COPIED_MS);
    return () => clearTimeout(timeout);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value.text);
      setCopied(true);
    } catch {
      // The page may deny clipboard access; the value stays on screen to type by hand.
    }
  }

  return (
    <div className="flex items-center gap-2 rounded-xl bg-nemu-subtle py-1.5 pr-1.5 pl-3">
      <span className="min-w-0 flex-1 font-medium">{value.label}</span>
      <Button
        variant="ghost"
        size="xs"
        className="text-nemu-text hover:bg-nemu-amber-100 hover:text-nemu-text"
        onClick={() => void copy()}
      >
        <CopyIcon data-icon="inline-start" />
        {copied ? "Tersalin" : "Salin"}
      </Button>
    </div>
  );
}
