import { NemuButton } from "@nemu/ui/nemu/nemu-button";

import { MASCOT_ART } from "../../mascot/lib/mascot-art";

type OtherSitePopupProps = {
  onOpenApp: () => void;
};

/**
 * What the toolbar icon shows on a page outside the allowlist, where Nemu reads nothing
 * (docs/design-system.md, "Toolbar popup"): the mascot and name, why nothing happens here, and a
 * way to the Demo App. The browser draws the popup's frame and shadow.
 */
export function OtherSitePopup({ onOpenApp }: OtherSitePopupProps) {
  return (
    <main className="flex w-80 flex-col gap-2.5 bg-background p-4 font-sans">
      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="size-7"
          dangerouslySetInnerHTML={{ __html: MASCOT_ART.idle }}
        />
        <span className="text-[13px]/[18px] font-medium">Nemu</span>
      </div>
      <h1 className="text-[15px]/[20px] font-semibold">Nemu aktif di AlurKerja</h1>
      <p className="text-[13px]/[18px] text-muted-foreground">
        Di situs ini Nemu tidak membaca apa pun. Buka AlurKerja untuk bertanya soal proses kerja.
      </p>
      <NemuButton tone="solid" className="w-full" onClick={onOpenApp}>
        Buka AlurKerja
      </NemuButton>
    </main>
  );
}
