import { Button } from "@nemu/ui/components/button";
import { type ReactNode, useMemo, useState } from "react";

import DemoPanel from "@/features/demo/components/demo-panel";
import { type DemoPageAction, DemoDockContext } from "@/features/demo/contexts/demo-dock-context";

/**
 * Keeps the demo controls out of the AlurKerja look: separate floating buttons at the bottom left,
 * over the end of the side menu, for the current page's one-click action and the demo panel.
 */
export default function DemoDock({ children }: { children: ReactNode }) {
  const [pageAction, setPageAction] = useState<DemoPageAction | null>(null);
  const context = useMemo(() => ({ setPageAction }), []);

  return (
    <DemoDockContext.Provider value={context}>
      {children}
      <div className="fixed bottom-4 left-4 z-40 flex flex-col items-start gap-2">
        {pageAction && (
          <Button
            size="sm"
            className="shadow-lg"
            data-nemu-id={pageAction.nemuId}
            onClick={pageAction.run}
          >
            {pageAction.label}
          </Button>
        )}
        <DemoPanel />
      </div>
    </DemoDockContext.Provider>
  );
}
