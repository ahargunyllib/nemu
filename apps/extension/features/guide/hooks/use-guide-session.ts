import type { NemuGuide } from "@nemu/contracts";
import { useCallback, useRef, useState } from "react";

import {
  clearGuideSession,
  type GuideSession,
  reserveGuideFollowUp,
  syncGuideSession,
} from "../lib/guide-session";

export function useGuideSession() {
  const current = useRef<GuideSession | null>(null);
  const [session, setSession] = useState<GuideSession | null>(null);

  const synchronize = useCallback((prompt: string, guide?: NemuGuide) => {
    const next = guide ? syncGuideSession(current.current, prompt, guide) : clearGuideSession();
    current.current = next;
    setSession(next);
  }, []);

  const reserveFollowUp = useCallback((pageUrl: string) => {
    if (!current.current) return false;

    const reservation = reserveGuideFollowUp(current.current, pageUrl);
    if (reservation.shouldFollowUp) {
      current.current = reservation.session;
      setSession(reservation.session);
    }
    return reservation.shouldFollowUp;
  }, []);

  const clear = useCallback(() => {
    current.current = clearGuideSession();
    setSession(current.current);
  }, []);

  return { session, synchronize, reserveFollowUp, clear };
}
