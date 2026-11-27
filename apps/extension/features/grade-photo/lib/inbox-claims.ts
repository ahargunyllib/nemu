import type { InboxJob } from "@nemu/contracts/school";

/**
 * F1-01: a new photo shows as a card in one tab only. Each visible allowed tab polls; the first
 * to ask claims the photo for a short lease that its polling renews, so another tab never shows
 * the same card. A tab that starts on the photo holds it until it is done; a closed tab lets go.
 */

/** A card claim lapses when its tab stops polling (hidden, closed, navigated away). */
export const CLAIM_LEASE_MS = 12_000;

export type InboxClaim = { tabId: number; at: number; held: boolean };
export type InboxClaims = Record<string, InboxClaim>;

/** Photos worth a card: waiting to be read, or read and not yet finished. */
export function isOpenJob(job: InboxJob): boolean {
  return job.status === "queued" || job.status === "ready";
}

/** The jobs this tab may show, and the claims after this poll. */
export function claimJobs(
  claims: InboxClaims,
  jobs: readonly InboxJob[],
  tabId: number,
  now: number,
): { mine: InboxJob[]; claims: InboxClaims } {
  const next: InboxClaims = {};
  const mine: InboxJob[] = [];
  for (const job of jobs) {
    if (!isOpenJob(job)) continue;
    const claim = claims[job.jobId];
    const free = !claim || (!claim.held && now - claim.at > CLAIM_LEASE_MS);
    if (free || claim.tabId === tabId) {
      next[job.jobId] = { tabId, at: now, held: claim?.tabId === tabId && claim.held };
      mine.push(job);
    } else next[job.jobId] = claim;
  }
  return { mine, claims: next };
}

/** The tab starts on the photo: no other tab shows it until it is released. */
export function holdJob(claims: InboxClaims, jobId: string, tabId: number, now: number) {
  return { ...claims, [jobId]: { tabId, at: now, held: true } };
}

/** Done, stopped, or the tab closed: the photo may show elsewhere again (if it still exists). */
export function releaseJobs(
  claims: InboxClaims,
  match: (jobId: string, claim: InboxClaim) => boolean,
): InboxClaims {
  return Object.fromEntries(
    Object.entries(claims).filter(([jobId, claim]) => !match(jobId, claim)),
  );
}
