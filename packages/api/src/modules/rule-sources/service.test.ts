import { describe, expect, it } from "vite-plus/test";

import type { DocumentFileStore } from "../../context";
import { createMigratedDb } from "../../testing/d1";
import { createDocumentRepository } from "../documents/repository";
import { deleteDocument, uploadDocument } from "../documents/service";
import { createRuleSourceRepository } from "./repository";
import { listRuleSources, resetRuleSource, setRuleSource } from "./service";

const files: DocumentFileStore = {
  async put() {},
  async get() {
    return null;
  },
  async delete() {},
};

async function createDeps() {
  const db = await createMigratedDb();
  return { documents: createDocumentRepository(db), ruleSources: createRuleSourceRepository(db) };
}

async function uploadSbm2027(deps: Awaited<ReturnType<typeof createDeps>>) {
  return uploadDocument(
    { documents: deps.documents, files },
    {
      workspaceId: "W-TRAVEL",
      title: "PMK 39 Tahun 2026 SBM TA 2027",
      version: "TA 2027",
      isActive: true,
      file: new File(
        [
          "# PMK 39 Tahun 2026\n\n[Halaman 21]\n\n30. SATUAN BIAYA PENGINAPAN PERJALANAN DINAS DALAM NEGERI TA 2027\n",
        ],
        "pmk-39-2026.md",
      ),
    },
  );
}

const lodging = (sources: Awaited<ReturnType<typeof listRuleSources>>) =>
  sources.find((source) => source.key === "travel.sbm_lodging");

describe("rule sources on D1", () => {
  it("resolves every travel rule to its seeded default source", async () => {
    const deps = await createDeps();

    const sources = await listRuleSources(deps, "W-TRAVEL");

    expect(sources.map((source) => source.key)).toEqual([
      "travel.sbm_lodging",
      "travel.sbm_daily_allowance",
      "travel.accommodation_lump_sum",
      "travel.accountability_deadline",
    ]);
    expect(sources.every((source) => source.isDefault && source.citationId)).toBe(true);
    expect(lodging(sources)).toMatchObject({
      documentId: "pmk-32-2025",
      documentTitle: "PMK 32 Tahun 2025 SBM TA 2026 (kutipan perjalanan dinas)",
      page: 19,
    });
  });

  it("re-points a rule at an uploaded document and falls back when that document is deleted", async () => {
    const deps = await createDeps();
    const uploaded = await uploadSbm2027(deps);
    expect(uploaded.status).toBe("ready");

    expect(
      await setRuleSource(deps, "W-TRAVEL", {
        key: "travel.sbm_lodging",
        documentId: uploaded.id,
        page: 21,
      }),
    ).toBe("saved");
    const chosen = lodging(await listRuleSources(deps, "W-TRAVEL"));
    expect(chosen).toMatchObject({
      documentId: uploaded.id,
      documentTitle: "PMK 39 Tahun 2026 SBM TA 2027",
      page: 21,
      isDefault: false,
    });
    const [chunk] = (await deps.documents.listActiveReadyChunks("W-TRAVEL")).filter(
      (candidate) => candidate.documentId === uploaded.id && candidate.page === 21,
    );
    expect(chosen?.citationId).toBe(chunk?.id);

    await deleteDocument({ documents: deps.documents, files }, "W-TRAVEL", uploaded.id);

    expect(lodging(await listRuleSources(deps, "W-TRAVEL"))).toMatchObject({
      documentId: "pmk-32-2025",
      isDefault: true,
    });
  });

  it("reports an unresolved rule when its chosen location matches no active chunk", async () => {
    const deps = await createDeps();
    const uploaded = await uploadSbm2027(deps);
    await setRuleSource(deps, "W-TRAVEL", {
      key: "travel.sbm_lodging",
      documentId: uploaded.id,
      page: 99,
    });

    expect(lodging(await listRuleSources(deps, "W-TRAVEL"))?.citationId).toBeNull();

    await resetRuleSource(deps, "W-TRAVEL", "travel.sbm_lodging");
    expect(lodging(await listRuleSources(deps, "W-TRAVEL"))?.citationId).not.toBeNull();
  });

  it("refuses another workspace's rule or document", async () => {
    const deps = await createDeps();

    expect(
      await setRuleSource(deps, "W-TRAVEL", {
        key: "telco.claim_cutoff",
        documentId: "pmk-32-2025",
      }),
    ).toBe("rule_not_found");
    expect(
      await setRuleSource(deps, "W-TRAVEL", {
        key: "travel.sbm_lodging",
        documentId: "SOP-KLAIM-SLA-01-v1.0",
      }),
    ).toBe("document_not_found");
  });
});
