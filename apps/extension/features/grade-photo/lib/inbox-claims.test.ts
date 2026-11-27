import type { InboxJob } from "@nemu/contracts/school";
import { describe, expect, test } from "vite-plus/test";

import { CLAIM_LEASE_MS, claimJobs, holdJob, releaseJobs } from "./inbox-claims";

function job(jobId: string, status: InboxJob["status"] = "queued"): InboxJob {
  return {
    jobId,
    source: "whatsapp",
    status,
    createdAt: 1,
    reading: null,
    verification: null,
    message: null,
  };
}

describe("a WhatsApp photo shows in one tab only (F1-01)", () => {
  test("the first tab to poll claims it; another tab doesn't see it while the lease lasts", () => {
    const first = claimJobs({}, [job("a")], 1, 1000);
    expect(first.mine.map((item) => item.jobId)).toEqual(["a"]);
    const second = claimJobs(first.claims, [job("a")], 2, 2000);
    expect(second.mine).toEqual([]);
    // The first tab keeps it by polling.
    expect(claimJobs(second.claims, [job("a")], 1, 4000).mine).toHaveLength(1);
  });

  test("when the claiming tab stops polling (hidden or closed), the next visible tab gets it", () => {
    const first = claimJobs({}, [job("a")], 1, 1000);
    const later = claimJobs(first.claims, [job("a")], 2, 1000 + CLAIM_LEASE_MS + 1);
    expect(later.mine.map((item) => item.jobId)).toEqual(["a"]);
  });

  test("a held photo stays with its tab until released; finished or failed photos aren't offered", () => {
    const held = holdJob({}, "a", 1, 1000);
    expect(claimJobs(held, [job("a", "ready")], 2, 1000 + CLAIM_LEASE_MS * 10).mine).toEqual([]);
    const released = releaseJobs(held, (jobId) => jobId === "a");
    expect(claimJobs(released, [job("a", "ready")], 2, 5000).mine).toHaveLength(1);
    expect(claimJobs({}, [job("b", "failed"), job("c", "processing")], 1, 1).mine).toEqual([]);
  });

  test("claims of photos that are gone are dropped", () => {
    const first = claimJobs({}, [job("a"), job("b")], 1, 1000);
    expect(Object.keys(claimJobs(first.claims, [job("b")], 1, 2000).claims)).toEqual(["b"]);
  });
});
