import NavigatedViewer from "bpmn-js/lib/NavigatedViewer";
import { type RefObject, useEffect, useState } from "react";

import "bpmn-js/dist/assets/diagram-js.css";
import "bpmn-js/dist/assets/bpmn-js.css";

/** Marker classes the diagram's container styles: the cause, and the rest of Nemu's steps. */
const CAUSE_MARKER = "nemu-cause";
const PATH_MARKER = "nemu-path";

type Canvas = {
  zoom(level: "fit-viewport", center?: "auto"): void;
  addMarker(element: string, marker: string): void;
};
type ElementRegistry = { get(id: string): unknown };

/**
 * Draws a BPMN file read-only with bpmn-js (pan and zoom only) and marks the given elements.
 * Returns the import error, if any, so the page can say the file can't be drawn.
 */
export function useBpmnViewer(
  container: RefObject<HTMLDivElement | null>,
  xml: string | undefined,
  elementId: string | null,
  pathIds: readonly string[],
): string | null {
  const [error, setError] = useState<string | null>(null);
  const pathKey = pathIds.join(",");

  useEffect(() => {
    if (!container.current || xml === undefined) return;
    const viewer = new NavigatedViewer({ container: container.current });
    let live = true;
    viewer
      .importXML(xml)
      .then(() => {
        if (!live) return;
        const canvas = viewer.get<Canvas>("canvas");
        const registry = viewer.get<ElementRegistry>("elementRegistry");
        for (const id of pathKey.split(",")) {
          if (id && id !== elementId && registry.get(id)) canvas.addMarker(id, PATH_MARKER);
        }
        if (elementId && registry.get(elementId)) canvas.addMarker(elementId, CAUSE_MARKER);
        canvas.zoom("fit-viewport", "auto");
        setError(null);
      })
      .catch((importError: unknown) => {
        if (live)
          setError(importError instanceof Error ? importError.message : String(importError));
      });
    return () => {
      live = false;
      viewer.destroy();
    };
  }, [container, xml, elementId, pathKey]);

  return error;
}
