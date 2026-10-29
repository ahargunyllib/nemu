import type { NemuGuide, NemuGuideStep } from "@nemu/contracts";

export type GuideSession = {
  prompt: string;
  guideId: string;
  steps: readonly NemuGuideStep[];
  currentStep: number;
  visitedSignatures: readonly string[];
};

export function syncGuideSession(
  session: GuideSession | null,
  prompt: string,
  guide: NemuGuide,
): GuideSession {
  const continuesCurrentGuide = session?.guideId === guide.id && session.prompt === prompt;

  return {
    prompt,
    guideId: guide.id,
    steps: guide.steps,
    currentStep: guide.current_step,
    visitedSignatures: continuesCurrentGuide ? session.visitedSignatures : [],
  };
}

export function clearGuideSession(): null {
  return null;
}

export function reserveGuideFollowUp(
  session: GuideSession,
  pageUrl: string,
): { session: GuideSession; shouldFollowUp: boolean } {
  const url = new URL(pageUrl);
  url.hash = "";
  const signature = `${session.guideId}:${session.currentStep}:${url.href}`;

  if (session.visitedSignatures.includes(signature)) {
    return { session, shouldFollowUp: false };
  }

  return {
    session: {
      ...session,
      visitedSignatures: [...session.visitedSignatures, signature],
    },
    shouldFollowUp: true,
  };
}
