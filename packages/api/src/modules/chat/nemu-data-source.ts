import type { KnowledgeChunk, NemuUserProfile, SbmRow, SlaClaimContext } from "@nemu/ai";
import type { NemuRequest, NemuResponse, ProcessContext } from "@nemu/contracts";

import type { NemuService } from "../../context";
import { WORKSPACES } from "../../workspace-ids";

import type { ActiveKnowledgeChunkRecord, DocumentRepository } from "../documents/repository";
import type {
  ReferenceTableRecord,
  ReferenceTableRepository,
} from "../reference-tables/repository";
import { REFERENCE_TABLE_TYPES, type ReferenceTableType } from "../reference-tables/table-types";

export const REQUIRED_ACCOUNTABILITY_DOCUMENTS: readonly string[] = [
  "surat_tugas",
  "boarding_pass_pergi",
  "boarding_pass_pulang",
  "laporan_perjalanan",
];

export type NemuProfileRecord = {
  id: string;
  name: string;
  golongan: string | null;
  unit: string | null;
  province: string | null;
};

export type NemuRuntimeSnapshot = {
  userProfile: NemuUserProfile;
  processContext?: ProcessContext;
  knowledgeChunks: readonly KnowledgeChunk[];
  sbmRows: readonly SbmRow[];
  holidays: readonly string[];
  requiredDocuments: readonly string[];
  currentDate: string;
  slaClaim?: SlaClaimContext;
};

export type NemuRuntimeDataSource = {
  load(userId: string, request: NemuRequest): Promise<NemuRuntimeSnapshot>;
};

export type NemuEngine = {
  respond(request: NemuRequest, snapshot: NemuRuntimeSnapshot): Promise<NemuResponse>;
};

export function createRuntimeNemuService(
  dataSource: NemuRuntimeDataSource,
  engine: NemuEngine,
): NemuService {
  return {
    async respond(request, authenticatedUserId) {
      const snapshot = await dataSource.load(authenticatedUserId, request);
      return engine.respond(request, snapshot);
    },
  };
}

export type NemuRuntimeDataDeps = {
  profiles: { findById(userId: string): Promise<NemuProfileRecord | undefined> };
  documents: Pick<DocumentRepository, "listActiveReadyChunks">;
  tables: Pick<ReferenceTableRepository, "findByType">;
  slaClaims?: {
    loadContext(workspaceId: string, claimId: string): Promise<SlaClaimContext>;
  };
  currentDate(workspaceId: string): Promise<string> | string;
};

type StoredRow = ReferenceTableRecord["rows"][number];

function stringValue(row: StoredRow, column: string, table: ReferenceTableType): string {
  const value = row[column];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Invalid ${table}.${column}: expected a non-empty string`);
  }
  return value;
}

function numberValue(row: StoredRow, column: string, table: ReferenceTableType): number {
  const value = row[column];
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new Error(`Invalid ${table}.${column}: expected a non-negative integer`);
  }
  return value;
}

function normalize(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLocaleLowerCase("id-ID")
    .replace(/[^a-z0-9]+/gu, " ")
    .trim();
}

function citationForPmk32(chunks: readonly ActiveKnowledgeChunkRecord[], page: number): string {
  const chunk = chunks.find((candidate) => {
    const title = normalize(candidate.documentTitle);
    return title.includes("pmk 32") && title.includes("2025") && candidate.page === page;
  });
  if (!chunk) {
    throw new Error(`No active knowledge citation matches PMK 32/2025 page ${page}`);
  }
  return chunk.id;
}

function adaptKnowledgeChunks(chunks: readonly ActiveKnowledgeChunkRecord[]): KnowledgeChunk[] {
  return chunks.map((chunk) => ({
    id: chunk.id,
    docId: chunk.documentId,
    title: chunk.documentTitle,
    version: chunk.documentVersion,
    ...((chunk.article ?? chunk.section)
      ? { article: chunk.article ?? chunk.section ?? undefined }
      : {}),
    ...(chunk.page === null ? {} : { page: chunk.page }),
    active: true,
    text: chunk.text,
  }));
}

function adaptSbmRows(
  tables: ReadonlyMap<ReferenceTableType, ReferenceTableRecord>,
  chunks: readonly ActiveKnowledgeChunkRecord[],
): SbmRow[] {
  const dailyType = "sbm2026_uang_harian_dalam_negeri";
  const lodgingType = "sbm2026_penginapan_dalam_negeri";
  const ticketType = "sbm2026_tiket_pesawat_pp_dalam_negeri";
  const transportType = "sbm2026_transport_terminal_bandara";
  const sourceByPage = new Map([
    [15, citationForPmk32(chunks, 15)],
    [19, citationForPmk32(chunks, 19)],
    [85, citationForPmk32(chunks, 85)],
    [86, citationForPmk32(chunks, 86)],
  ]);

  const daily = tables.get(dailyType)?.rows.flatMap((row): SbmRow[] => [
    {
      province: stringValue(row, "provinsi", dailyType),
      component: "uang_harian",
      grade: "*",
      value: numberValue(row, "luar_kota", dailyType),
      source: stringValue(row, "sumber", dailyType),
      sourceCitationId: sourceByPage.get(15)!,
    },
  ]);
  const lodging = tables.get(lodgingType)?.rows.flatMap((row): SbmRow[] => {
    const province = stringValue(row, "provinsi", lodgingType);
    const source = stringValue(row, "sumber", lodgingType);
    const common = {
      province,
      component: "hotel" as const,
      source,
      sourceCitationId: sourceByPage.get(19)!,
    };
    return [
      { ...common, grade: "IV", value: numberValue(row, "eselon_III_golongan_IV", lodgingType) },
      ...["III", "II", "I"].map((grade) => ({
        ...common,
        grade,
        value: numberValue(row, "eselon_IV_golongan_III_II_I", lodgingType),
      })),
    ];
  });
  const tickets = tables.get(ticketType)?.rows.flatMap((row): SbmRow[] => {
    const province = `${stringValue(row, "kota_asal", ticketType)} - ${stringValue(row, "kota_tujuan", ticketType)}`;
    const common = {
      province,
      component: "tiket_pesawat" as const,
      source: "PMK 32/2025 Lampiran II angka 17",
      sourceCitationId: sourceByPage.get(86)!,
    };
    return [
      { ...common, grade: "bisnis", value: numberValue(row, "bisnis_pp", ticketType) },
      { ...common, grade: "ekonomi", value: numberValue(row, "ekonomi_pp", ticketType) },
    ];
  });
  const transport = tables.get(transportType)?.rows.flatMap((row): SbmRow[] => [
    {
      province: stringValue(row, "provinsi", transportType),
      component: "transport_bandara",
      grade: "*",
      value: numberValue(row, "besaran_per_orang_per_kali", transportType),
      source: stringValue(row, "sumber", transportType),
      sourceCitationId: sourceByPage.get(85)!,
    },
  ]);

  return [...(lodging ?? []), ...(daily ?? []), ...(tickets ?? []), ...(transport ?? [])];
}

function requireProfile(profile: NemuProfileRecord | undefined, userId: string): NemuUserProfile {
  if (!profile) throw new Error(`Nemu profile not found for user ${userId}`);
  const missing = [
    !profile.name && "name",
    !profile.golongan && "golongan",
    !profile.unit && "unit",
    !profile.province && "province",
  ].filter((field): field is string => Boolean(field));
  if (missing.length > 0) {
    throw new Error(`Nemu profile for user ${userId} is missing ${missing.join(", ")}`);
  }
  return {
    userId,
    name: profile.name,
    grade: profile.golongan!,
    unit: profile.unit!,
    province: profile.province!,
  };
}

export function createNemuRuntimeDataSource(deps: NemuRuntimeDataDeps): NemuRuntimeDataSource {
  return {
    async load(userId, request) {
      const workspace = request.process_context?.workspace;
      const workspaceId = workspace?.id ?? WORKSPACES.travel;
      if (workspace?.domain === "telco_sla") {
        if (workspaceId !== WORKSPACES.telco) {
          throw new Error(`Unsupported telco workspace: ${workspaceId}`);
        }
        if (!deps.slaClaims) {
          throw new Error("SLA claim data source is not configured");
        }
        const [profile, chunks, slaClaim] = await Promise.all([
          deps.profiles.findById(userId),
          deps.documents.listActiveReadyChunks(workspaceId),
          deps.slaClaims.loadContext(workspaceId, request.process_context!.instance_id),
        ]);
        return {
          userProfile: requireProfile(profile, userId),
          processContext: request.process_context,
          knowledgeChunks: adaptKnowledgeChunks(chunks),
          sbmRows: [],
          holidays: [],
          requiredDocuments: [],
          currentDate: await deps.currentDate(workspaceId),
          slaClaim,
        };
      }
      const [profile, chunks, ...storedTables] = await Promise.all([
        deps.profiles.findById(userId),
        deps.documents.listActiveReadyChunks(workspaceId),
        ...REFERENCE_TABLE_TYPES.map((type) => deps.tables.findByType(type)),
      ]);
      const tables = new Map<ReferenceTableType, ReferenceTableRecord>();
      for (const [index, type] of REFERENCE_TABLE_TYPES.entries()) {
        const table = storedTables[index];
        if (!table) throw new Error(`Missing required reference table: ${type}`);
        tables.set(type, table);
      }
      const holidayType = "kalender_libur_2026";
      const holidays = tables
        .get(holidayType)!
        .rows.map((row) => stringValue(row, "tanggal", holidayType));

      return {
        userProfile: requireProfile(profile, userId),
        processContext: request.process_context,
        knowledgeChunks: adaptKnowledgeChunks(chunks),
        sbmRows: adaptSbmRows(tables, chunks),
        holidays,
        requiredDocuments: REQUIRED_ACCOUNTABILITY_DOCUMENTS,
        currentDate: await deps.currentDate(workspaceId),
      };
    },
  };
}
