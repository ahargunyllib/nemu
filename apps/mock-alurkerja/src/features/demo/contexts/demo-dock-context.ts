import { createContext } from "react";

/** A one-click shortcut the current page puts on the demo dock, e.g. filling its form. */
export type DemoPageAction = {
  label: string;
  nemuId: string;
  run: () => void;
};

export type DemoDockContextValue = {
  setPageAction: (action: DemoPageAction | null) => void;
};

export const DemoDockContext = createContext<DemoDockContextValue | null>(null);
