import { Button } from "@nemu/ui/components/button";
import { CardAction, CardDescription, CardHeader, CardTitle } from "@nemu/ui/components/card";
import { XIcon } from "lucide-react";

export function AnswerCardHeader({ prompt, onClose }: { prompt: string; onClose: () => void }) {
  return (
    <CardHeader>
      <CardTitle>Nemu</CardTitle>
      <CardDescription className="line-clamp-2">{prompt}</CardDescription>
      <CardAction>
        <Button aria-label="Tutup" size="icon-xs" variant="ghost" onClick={onClose}>
          <XIcon />
        </Button>
      </CardAction>
    </CardHeader>
  );
}
