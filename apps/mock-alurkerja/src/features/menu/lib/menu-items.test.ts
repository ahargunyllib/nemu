import { describe, expect, test } from "vite-plus/test";

import { claimInFocus } from "./menu-items";

const CLAIMS = [
  { id: "KLM-2610-0007", serviceId: "TN-ENT-002", invoiceId: "INV-2609-0042" },
  { id: "KLM-2610-0009", serviceId: "TN-ENT-001", invoiceId: "INV-2609-0041" },
  { id: "KLM-2610-0011", serviceId: "TN-ENT-003", invoiceId: "INV-2608-0039" },
];

describe("claimInFocus", () => {
  test("follows the claim, service, or invoice the page shows", () => {
    expect(claimInFocus(CLAIMS, "/sla-claims/KLM-2610-0009")?.id).toBe("KLM-2610-0009");
    expect(claimInFocus(CLAIMS, "/crm/TN-ENT-003")?.id).toBe("KLM-2610-0011");
    expect(claimInFocus(CLAIMS, "/noc/TN-ENT-001")?.id).toBe("KLM-2610-0009");
    expect(claimInFocus(CLAIMS, "/billing/INV-2608-0039")?.id).toBe("KLM-2610-0011");
  });

  test("falls back to the first claim on other pages", () => {
    expect(claimInFocus(CLAIMS, "/")?.id).toBe("KLM-2610-0007");
    expect(claimInFocus(CLAIMS, "/crm/TN-ENT-999")?.id).toBe("KLM-2610-0007");
    expect(claimInFocus([], "/sla-claims")).toBeUndefined();
  });
});
