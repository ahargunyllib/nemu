import { mkdir, writeFile } from "node:fs/promises";

import {
  buildTelcoWorkspaceSeed,
  buildTravelWorkspaceSeed,
  renderTelcoWorkspaceSeedSql,
  renderTravelWorkspaceSeedSql,
} from "./workspace-seed-lib.mjs";

const dataRoot = new URL("../../../data/", import.meta.url);
const migrationDirectory = new URL(
  "../../db/src/migrations/20261028172500_seed_travel_workspace/",
  import.meta.url,
);
const migrationFile = new URL("migration.sql", migrationDirectory);
const telcoMigrationDirectory = new URL(
  "../../db/src/migrations/20261028180000_seed_telco_workspace/",
  import.meta.url,
);
const telcoMigrationFile = new URL("migration.sql", telcoMigrationDirectory);

const seed = await buildTravelWorkspaceSeed(dataRoot);
const telcoSeed = await buildTelcoWorkspaceSeed(dataRoot);
await mkdir(migrationDirectory, { recursive: true });
await mkdir(telcoMigrationDirectory, { recursive: true });
await writeFile(migrationFile, renderTravelWorkspaceSeedSql(seed), "utf8");
await writeFile(telcoMigrationFile, renderTelcoWorkspaceSeedSql(telcoSeed), "utf8");
console.log(
  `Seeded ${seed.documents.length} travel documents and ${seed.chunks.length} chunks into ${migrationFile.pathname}; ` +
    `${telcoSeed.documents.length} telco documents, ${telcoSeed.chunks.length} chunks, and ${telcoSeed.claims.length} claims into ${telcoMigrationFile.pathname}`,
);
