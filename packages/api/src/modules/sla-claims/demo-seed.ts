import type { SlaTaskRecord } from "./repository";

// Dimas's three claim Tasks as the seed_telco_workspace migration inserts them: every claim
// waits at Registrasi Klaim. The claim steps update these rows in place; the demo panel's reset
// puts them back.
export const SLA_CLAIM_SEED_TASKS: readonly SlaTaskRecord[] = [
  {
    id: "T-0007-1",
    workspaceId: "W-TELKO",
    claimId: "KLM-2610-0007",
    name: "Registrasi Klaim",
    assigneeId: "U-101",
    createdAt: "2026-10-08T14:20:00+07:00",
    reviewDueOn: "2026-10-15",
    status: "OPEN",
    approvedBy: [],
  },
  {
    id: "T-0009-1",
    workspaceId: "W-TELKO",
    claimId: "KLM-2610-0009",
    name: "Registrasi Klaim",
    assigneeId: "U-101",
    createdAt: "2026-10-09T10:10:00+07:00",
    reviewDueOn: "2026-10-16",
    status: "OPEN",
    approvedBy: [],
  },
  {
    id: "T-0011-1",
    workspaceId: "W-TELKO",
    claimId: "KLM-2610-0011",
    name: "Registrasi Klaim",
    assigneeId: "U-101",
    createdAt: "2026-10-08T15:45:00+07:00",
    reviewDueOn: null,
    status: "OPEN",
    approvedBy: [],
  },
];
