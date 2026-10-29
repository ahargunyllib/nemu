/** A claim as the task list reads it from `listSlaClaims`. */
export type SlaClaim = { id: string; customer: string; serviceId: string; period: string };

/** A claim Task as the task list reads it from `listSlaClaimTasks`. */
export type SlaClaimTaskRow = {
  id: string;
  claimId: string;
  name: string;
  status: string;
  reviewDueOn: string | null;
};
