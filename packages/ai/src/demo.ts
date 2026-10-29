import {
  GENERATED_HOLIDAYS_2026,
  GENERATED_KNOWLEDGE_CHUNKS,
  GENERATED_SBM_ROWS,
} from "./demo.generated.js";
import type { NemuUserProfile } from "./openai.js";

// Offline test/evaluation fixtures only. The production server loads the equivalent
// profile, active chunks, reference tables, and holidays from database repositories.
export const DEMO_USER_PROFILE: NemuUserProfile = {
  userId: "rina",
  name: "Rina Pratiwi",
  grade: "III/a",
  unit: "Balai Layanan Digital Wilayah Yogyakarta",
  province: "DI Yogyakarta",
};

export const DEMO_KNOWLEDGE_CHUNKS = GENERATED_KNOWLEDGE_CHUNKS;
export const DEMO_SBM_ROWS = GENERATED_SBM_ROWS;
export const DEMO_HOLIDAYS_2026 = GENERATED_HOLIDAYS_2026;

export const DEMO_REQUIRED_DOCUMENTS: readonly string[] = [
  "surat_tugas",
  "boarding_pass_pergi",
  "boarding_pass_pulang",
  "laporan_perjalanan",
];
