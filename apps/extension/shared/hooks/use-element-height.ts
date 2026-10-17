import { useCallback, useState } from "react";

/** Measures an element's rendered height as it changes; attach the returned ref to it. */
export function useElementHeight<T extends HTMLElement>() {
  const [height, setHeight] = useState(0);

  const ref = useCallback((element: T | null) => {
    if (!element) return;
    const observer = new ResizeObserver(() => setHeight(element.offsetHeight));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return [ref, height] as const;
}
