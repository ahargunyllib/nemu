/** Bindings of the mock-alursekolah Worker, declared in packages/infra/alchemy.run.ts. */
export interface MockEnv {
  /** The mock's own D1 database (migrations/), separate from the Nemu Service's. */
  DB: D1Database;
  /** School API key (`as_...`) the read API accepts. */
  API_KEY: string;
}
