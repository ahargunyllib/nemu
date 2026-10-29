import type { NemuRequest } from "@nemu/contracts";
import { describe, expect, test } from "vite-plus/test";

import {
  createNemuRuntimeDataSource,
  createRuntimeNemuService,
  REQUIRED_ACCOUNTABILITY_DOCUMENTS,
  type NemuRuntimeDataDeps,
} from "./nemu-data-source";

const request = {
  session_id: "session-1",
  user_id: "rina",
  prompt: "Berapa batas hotel saya?",
  url: "https://demo.example/perjalanan-dinas",
  elements: [],
  process_context: {
    instance_id: "pd-1",
    uploaded_documents: [],
    status: "draft",
    destination_province: "SULAWESI SELATAN",
  },
} satisfies NemuRequest;

const activeChunks = [
  {
    id: "pmk32-page-15",
    documentId: "pmk-32-2025",
    documentTitle: "PMK 32 Tahun 2025 SBM TA 2026",
    documentVersion: "TA 2026",
    article: null,
    section: null,
    page: 15,
    sequence: 0,
    text: "Uang harian perjalanan dinas dalam negeri.",
  },
  {
    id: "pmk32-page-19",
    documentId: "pmk-32-2025",
    documentTitle: "PMK 32 Tahun 2025 SBM TA 2026",
    documentVersion: "TA 2026",
    article: null,
    section: null,
    page: 19,
    sequence: 1,
    text: "Satuan biaya penginapan perjalanan dinas dalam negeri.",
  },
  {
    id: "pmk32-page-85",
    documentId: "pmk-32-2025",
    documentTitle: "PMK 32 Tahun 2025 SBM TA 2026",
    documentVersion: "TA 2026",
    article: null,
    section: null,
    page: 85,
    sequence: 2,
    text: "Transportasi dari dan ke terminal atau bandara.",
  },
  {
    id: "pmk32-page-86",
    documentId: "pmk-32-2025",
    documentTitle: "PMK 32 Tahun 2025 SBM TA 2026",
    documentVersion: "TA 2026",
    article: null,
    section: null,
    page: 86,
    sequence: 3,
    text: "Tiket pesawat perjalanan dinas pergi pulang.",
  },
];

const tableRows = {
  sbm2026_uang_harian_dalam_negeri: [
    {
      no: 1,
      provinsi: "SULAWESI SELATAN",
      luar_kota: 430_000,
      dalam_kota_lebih_8_jam: 170_000,
      diklat: 130_000,
      satuan: "OH",
      sumber: "PMK 32/2025 Lampiran I angka 28.1, hlm. 15",
    },
  ],
  sbm2026_penginapan_dalam_negeri: [
    {
      no: 1,
      provinsi: "SULAWESI SELATAN",
      pejabat_negara_eselon_I: 4_820_000,
      pejabat_negara_lainnya_eselon_II: 1_490_000,
      eselon_III_golongan_IV: 1_025_000,
      eselon_IV_golongan_III_II_I: 745_000,
      satuan: "OH",
      sumber: "PMK 32/2025 Lampiran I angka 30, hlm. 19",
    },
  ],
  sbm2026_tiket_pesawat_pp_dalam_negeri: [
    {
      no: 1,
      kota_asal: "YOGYAKARTA",
      kota_tujuan: "MAKASSAR",
      bisnis_pp: 7_110_000,
      ekonomi_pp: 3_893_000,
    },
  ],
  sbm2026_transport_terminal_bandara: [
    {
      no: 1,
      provinsi: "SULAWESI SELATAN",
      besaran_per_orang_per_kali: 180_000,
      sumber: "PMK 32/2025 Lampiran II angka 16, hlm. 85",
    },
  ],
  kalender_libur_2026: [
    {
      tanggal: "2026-11-10",
      hari: "Selasa",
      jenis: "libur_nasional",
      keterangan: "Hari libur uji",
    },
  ],
} as const;

function createDeps(): NemuRuntimeDataDeps {
  return {
    profiles: {
      async findById() {
        return {
          id: "rina",
          name: "Rina dari Database",
          golongan: "III/a",
          unit: "Unit dari Database",
          province: "DI Yogyakarta",
        };
      },
    },
    documents: {
      async listActiveReadyChunks() {
        return activeChunks;
      },
    },
    tables: {
      async findByType(type) {
        const rows = tableRows[type as keyof typeof tableRows];
        return rows
          ? {
              type,
              fileName: `${type}.csv`,
              columns: Object.keys(rows[0] ?? {}),
              rows: [...rows],
              rowCount: rows.length,
              updatedAt: new Date("2026-01-01T00:00:00Z"),
            }
          : undefined;
      },
    },
    currentDate: () => "2026-11-06",
  };
}

describe("Nemu runtime data source", () => {
  test("loads W-TELKO knowledge and authoritative claim facts without travel tables", async () => {
    const deps = createDeps();
    let requestedWorkspace = "";
    deps.documents.listActiveReadyChunks = async (workspaceId) => {
      requestedWorkspace = workspaceId ?? "";
      return [
        {
          ...activeChunks[0]!,
          id: "sop-claim-2-1",
          documentId: "SOP-KLAIM-SLA-01-v1.0",
          documentTitle: "SOP Klaim SLA",
          documentVersion: "1.0",
          article: "2 ayat (1)",
          section: "Pasal 2. Batas waktu",
          page: null,
        },
      ];
    };
    deps.tables.findByType = async () => {
      throw new Error("travel tables must not load for W-TELKO");
    };
    deps.slaClaims = {
      async loadContext(workspaceId, claimId) {
        expect(workspaceId).toBe("W-TELKO");
        expect(claimId).toBe("KLM-2610-0007");
        return {
          workspaceId,
          claim: {
            id: claimId,
            serviceId: "TN-ENT-002",
            period: "2026-09",
            receivedAt: "2026-10-08T14:12:00+07:00",
            claimedMinutes: 1_530,
            invoiceId: "INV-2609-0042",
          },
          service: {
            contractId: "KON-2026-01",
            addendumId: "ADD-2026-02",
            effectiveSlaBasisPoints: 9_950,
          },
          invoice: { monthlyFeeIdr: 30_000_000 },
          tickets: [],
          approvalRules: [{ minimumAmount: 0, approvers: ["Sari Wulandari (Supervisor Billing)"] }],
          task: { reviewDueOn: "2026-10-15" },
        };
      },
    };
    const telcoRequest: NemuRequest = {
      session_id: "telco-session",
      prompt: "Ini masuk batas nggak?",
      url: "https://demo.example/sla-claims/KLM-2610-0007",
      elements: [],
      process_context: {
        instance_id: "KLM-2610-0007",
        uploaded_documents: [],
        workspace: { id: "W-TELKO", domain: "telco_sla" },
      },
    };

    const snapshot = await createNemuRuntimeDataSource(deps).load("rina", telcoRequest);

    expect(requestedWorkspace).toBe("W-TELKO");
    expect(snapshot.slaClaim?.claim.id).toBe("KLM-2610-0007");
    expect(snapshot.sbmRows).toEqual([]);
    expect(snapshot.holidays).toEqual([]);
    expect(snapshot.knowledgeChunks[0]?.article).toBe("2 ayat (1)");
  });

  test("loads the signed-in user's profile, active chunks, process context, and current date", async () => {
    const snapshot = await createNemuRuntimeDataSource(createDeps()).load("rina", request);

    expect(snapshot.userProfile).toEqual({
      userId: "rina",
      name: "Rina dari Database",
      grade: "III/a",
      unit: "Unit dari Database",
      province: "DI Yogyakarta",
    });
    expect(snapshot.processContext).toEqual(request.process_context);
    expect(snapshot.currentDate).toBe("2026-11-06");
    expect(snapshot.knowledgeChunks).toHaveLength(4);
    expect(snapshot.knowledgeChunks[0]).toMatchObject({
      id: "pmk32-page-15",
      docId: "pmk-32-2025",
      active: true,
    });
  });

  test("adapts uploaded SBM tables and resolves every row to an active knowledge citation", async () => {
    const snapshot = await createNemuRuntimeDataSource(createDeps()).load("rina", request);

    expect(snapshot.sbmRows).toContainEqual({
      province: "SULAWESI SELATAN",
      component: "hotel",
      grade: "III",
      value: 745_000,
      source: "PMK 32/2025 Lampiran I angka 30, hlm. 19",
      sourceCitationId: "pmk32-page-19",
    });
    expect(snapshot.sbmRows).toContainEqual({
      province: "SULAWESI SELATAN",
      component: "uang_harian",
      grade: "*",
      value: 430_000,
      source: "PMK 32/2025 Lampiran I angka 28.1, hlm. 15",
      sourceCitationId: "pmk32-page-15",
    });
    expect(snapshot.sbmRows).toContainEqual({
      province: "YOGYAKARTA - MAKASSAR",
      component: "tiket_pesawat",
      grade: "ekonomi",
      value: 3_893_000,
      source: "PMK 32/2025 Lampiran II angka 17",
      sourceCitationId: "pmk32-page-86",
    });
    expect(snapshot.holidays).toEqual(["2026-11-10"]);
    expect(snapshot.requiredDocuments).toEqual(REQUIRED_ACCOUNTABILITY_DOCUMENTS);
  });

  test("refuses a table citation after its active source document is deactivated", async () => {
    const deps = createDeps();
    let chunks = activeChunks;
    deps.documents.listActiveReadyChunks = async () => chunks;
    const source = createNemuRuntimeDataSource(deps);

    expect((await source.load("rina", request)).knowledgeChunks).toHaveLength(4);
    chunks = activeChunks.slice(0, 3);

    await expect(source.load("rina", request)).rejects.toThrow(
      "No active knowledge citation matches PMK 32/2025 page 86",
    );
  });

  test("reflects a reference-table update in the next request", async () => {
    const deps = createDeps();
    let hotelRate = 745_000;
    const baseFind = deps.tables.findByType;
    deps.tables.findByType = async (type) => {
      const table = await baseFind(type);
      if (type !== "sbm2026_penginapan_dalam_negeri" || !table) return table;
      return {
        ...table,
        rows: table.rows.map((row) => ({
          ...row,
          eselon_IV_golongan_III_II_I: hotelRate,
        })),
      };
    };
    const source = createNemuRuntimeDataSource(deps);
    const gradeThreeHotel = (snapshot: Awaited<ReturnType<typeof source.load>>) =>
      snapshot.sbmRows.find((row) => row.component === "hotel" && row.grade === "III")?.value;

    expect(gradeThreeHotel(await source.load("rina", request))).toBe(745_000);
    hotelRate = 800_000;
    expect(gradeThreeHotel(await source.load("rina", request))).toBe(800_000);
  });

  test("removes a deactivated document from the next retrieval snapshot", async () => {
    const deps = createDeps();
    const extraChunk = {
      ...activeChunks[0]!,
      id: "sop-section-1",
      documentId: "sop-pd-01",
      documentTitle: "SOP Perjalanan Dinas",
      page: null,
    };
    let chunks = [...activeChunks, extraChunk];
    deps.documents.listActiveReadyChunks = async () => chunks;
    const source = createNemuRuntimeDataSource(deps);

    expect((await source.load("rina", request)).knowledgeChunks.map((chunk) => chunk.id)).toContain(
      "sop-section-1",
    );
    chunks = [...activeChunks];
    expect(
      (await source.load("rina", request)).knowledgeChunks.map((chunk) => chunk.id),
    ).not.toContain("sop-section-1");
  });

  test("fails clearly instead of using demo values when a required table is absent", async () => {
    const deps = createDeps();
    deps.tables.findByType = async (type) =>
      type === "kalender_libur_2026" ? undefined : createDeps().tables.findByType(type);

    await expect(createNemuRuntimeDataSource(deps).load("rina", request)).rejects.toThrow(
      "Missing required reference table: kalender_libur_2026",
    );
  });

  test("fails clearly when the user profile is incomplete", async () => {
    const deps = createDeps();
    deps.profiles.findById = async () => ({
      id: "rina",
      name: "Rina",
      golongan: "III/a",
      unit: null,
      province: null,
    });

    await expect(createNemuRuntimeDataSource(deps).load("rina", request)).rejects.toThrow(
      "Nemu profile for user rina is missing unit, province",
    );
  });

  test("loads a new snapshot before every AI response", async () => {
    let name = "First database value";
    const deps = createDeps();
    deps.profiles.findById = async () => ({
      id: "rina",
      name,
      golongan: "III/a",
      unit: "Unit",
      province: "DI Yogyakarta",
    });
    const observedNames: string[] = [];
    const service = createRuntimeNemuService(createNemuRuntimeDataSource(deps), {
      async respond(_request, snapshot) {
        observedNames.push(snapshot.userProfile.name);
        return {
          status: "answer",
          answer: { ringkas: snapshot.userProfile.name, detail: "" },
          citations: [],
          calc: [],
          actions: [],
          warnings: [],
          timing: { total_ms: 1 },
        };
      },
    });

    await service.respond(request, "rina");
    name = "Updated database value";
    await service.respond(request, "rina");

    expect(observedNames).toEqual(["First database value", "Updated database value"]);
  });
});
