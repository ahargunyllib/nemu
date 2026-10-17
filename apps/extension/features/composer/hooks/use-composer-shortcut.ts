import { useEffect, useRef } from "react";
import { browser } from "wxt/browser";

import { isOpenComposerMessage } from "../lib/open-composer-message";

export type CursorPosition = { x: number; y: number };

/**
 * Calls `onOpen` with the last cursor position when the background relays the extension
 * action: the toolbar icon or its shortcut (Ctrl+Shift+Space by default). The shortcut is an
 * extension command rather than a page keydown listener because the OS or browser can swallow
 * the keys before the page sees them.
 */
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
    function openOnMessage(message: unknown) {
      if (isOpenComposerMessage(message)) latestOnOpen.current(cursor.current);
    }

    window.addEventListener("mousemove", trackCursor, { passive: true });
    browser.runtime.onMessage.addListener(openOnMessage);
    return () => {
      window.removeEventListener("mousemove", trackCursor);
      browser.runtime.onMessage.removeListener(openOnMessage);
    };
  }, []);
}
