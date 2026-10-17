import { useContext, useEffect, useRef } from "react";

import { type DemoPageAction, DemoDockContext } from "@/features/demo/contexts/demo-dock-context";

/** Shows `action` on the demo dock while the calling page is open. */
export function useDemoPageAction({ label, nemuId, run }: DemoPageAction) {
  const dock = useContext(DemoDockContext);
  if (!dock) throw new Error("useDemoPageAction must be used inside DemoDock");
  const { setPageAction } = dock;
  // The latest run, so a page can pass a fresh closure every render without re-registering.
  const runRef = useRef(run);
  runRef.current = run;

  useEffect(() => {
    setPageAction({ label, nemuId, run: () => runRef.current() });
    return () => setPageAction(null);
  }, [setPageAction, label, nemuId]);
}
