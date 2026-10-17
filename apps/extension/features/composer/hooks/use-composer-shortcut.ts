import { useEffect, useRef } from "react";

export type CursorPosition = { x: number; y: number };

function isComposerShortcut(event: KeyboardEvent): boolean {
  return (
    event.ctrlKey && event.shiftKey && !event.altKey && !event.metaKey && event.code === "Space"
  );
}

/** Calls `onOpen` with the last cursor position when the user presses Ctrl+Shift+Space. */
export function useComposerShortcut(onOpen: (position: CursorPosition) => void) {
  const cursor = useRef<CursorPosition>({ x: window.innerWidth / 2, y: window.innerHeight / 3 });
  const latestOnOpen = useRef(onOpen);

  useEffect(() => {
    latestOnOpen.current = onOpen;
  });

  useEffect(() => {
    function trackCursor(event: MouseEvent) {
      cursor.current = { x: event.clientX, y: event.clientY };
    }
    function openOnShortcut(event: KeyboardEvent) {
      if (!isComposerShortcut(event)) return;
      event.preventDefault();
      latestOnOpen.current(cursor.current);
    }

    window.addEventListener("mousemove", trackCursor, { passive: true });
    window.addEventListener("keydown", openOnShortcut, true);
    return () => {
      window.removeEventListener("mousemove", trackCursor);
      window.removeEventListener("keydown", openOnShortcut, true);
    };
  }, []);
}
