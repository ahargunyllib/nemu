import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import "varlock/auto-load";

// Custom domains belong to prod only; personal dev_* stages stay on workers.dev.
const isProd = process.env.ALCHEMY_STAGE === "prod";

export const db = Cloudflare.D1.Database("database", {
  migrations: "../../packages/db/src/migrations",
});

// Knowledge document files uploaded in the Admin Workspace; metadata lives in D1.
export const documents = Cloudflare.R2.Bucket("documents");

// Grade-book photo jobs (Nemu v2.2). Deleted when the teacher saves; this rule removes leftovers
// after a day (UU PDP: photos of children's grades are not kept).
export const inbox = Cloudflare.R2.Bucket("inbox", {
  lifecycleRules: [
    {
      id: "delete-photo-jobs-after-1-day",
      deleteObjectsTransition: { condition: { type: "Age", maxAge: 60 * 60 * 24 } },
    },
  ],
});

export const server = Cloudflare.Worker("server", {
  main: "../../apps/server/src/index.ts",
  domain: isProd ? "nemu-api.ahargunyllib.dev" : undefined,
  compatibility: {
    flags: ["nodejs_compat"],
  },
  env: {
    DB: db,
    DOCUMENTS: documents,
    INBOX: inbox,
    CORS_ORIGIN: Config.String("CORS_ORIGIN"),
    BETTER_AUTH_SECRET: Config.Redacted("BETTER_AUTH_SECRET"),
    BETTER_AUTH_URL: Cloudflare.Worker.URL,
    NEMU_RESPONDER: Config.String("NEMU_RESPONDER").pipe(Config.withDefault("ai")),
    // Optional so fixture mode deploys without a key; the AI responder rejects an empty one.
    OPENROUTER_API_KEY: Config.Redacted("OPENROUTER_API_KEY").pipe(
      Config.withDefault(Redacted.make("")),
    ),
    NEMU_DEMO_DATE: Config.String("NEMU_DEMO_DATE"),
    OPENROUTER_SCHOOL_READ_A_MODEL: Config.String("OPENROUTER_SCHOOL_READ_A_MODEL").pipe(
      Config.withDefault("google/gemini-4-hydrogen"),
    ),
    OPENROUTER_SCHOOL_READ_B_MODEL: Config.String("OPENROUTER_SCHOOL_READ_B_MODEL").pipe(
      Config.withDefault("openai/gpt-6.1-terra"),
    ),
    OPENROUTER_SCHOOL_REREAD_MODEL: Config.String("OPENROUTER_SCHOOL_REREAD_MODEL").pipe(
      Config.withDefault("openai/gpt-6.2-sol"),
    ),
    OPENROUTER_SCHOOL_TEXT_MODEL: Config.String("OPENROUTER_SCHOOL_TEXT_MODEL").pipe(
      Config.withDefault("anthropic/claude-haiku-5.5"),
    ),
    OPENROUTER_STT_MODEL: Config.String("OPENROUTER_STT_MODEL").pipe(
      Config.withDefault("microsoft/mai-transcribe-2"),
    ),
    OPENROUTER_TTS_MODEL: Config.String("OPENROUTER_TTS_MODEL").pipe(
      Config.withDefault("microsoft/mai-voice-2.1-flash"),
    ),
    OPENROUTER_TTS_VOICE: Config.String("OPENROUTER_TTS_VOICE").pipe(
      Config.withDefault("id-ID-Harper:MAI-Voice-2.1-Flash"),
    ),
    OPENROUTER_ZDR: Config.String("OPENROUTER_ZDR").pipe(Config.withDefault("false")),
    // Shared with apps/wa-bot on the team VPS. Optional so the Worker deploys without it; while it's
    // empty the wa-bot endpoints refuse every call.
    WA_BOT_SECRET: Config.Redacted("WA_BOT_SECRET").pipe(Config.withDefault(Redacted.make(""))),
    // Encrypts WS-07 integration settings in D1. Optional so the Worker deploys without it; while
    // it's empty WS-07 can't save, and AlurSekolah reads fail with a clear message.
    INTEGRATION_SECRETS_KEY: Config.Redacted("INTEGRATION_SECRETS_KEY").pipe(
      Config.withDefault(Redacted.make("")),
    ),
  },
  dev: {
    port: 3000,
  },
});

export type ServerEnv = Cloudflare.InferEnv<typeof server>;

// Mock AlurSekolah (#196): the page the extension runs on until the school's test tenant exists,
// plus a read API shaped like AlurSekolah API v1. Its data is a separate fake system, so it has its
// own database instead of tables in the Nemu Service's.
export const mockAlurSekolahDb = Cloudflare.D1.Database("mock-alursekolah-db", {
  migrations: "../../apps/mock-alursekolah/migrations",
});

export const mockAlurSekolah = Cloudflare.Worker("mock-alursekolah", {
  main: "../../apps/mock-alursekolah/src/worker.ts",
  assets: "../../apps/mock-alursekolah/public",
  domain: isProd ? "nemu-alursekolah.ahargunyllib.dev" : undefined,
  env: {
    DB: mockAlurSekolahDb,
    // The school API key the Nemu Service stores in WS-07. Synthetic data only, so a known
    // default keeps dev stages working without extra setup.
    API_KEY: Config.Redacted("MOCK_ALURSEKOLAH_API_KEY").pipe(
      Config.withDefault(Redacted.make("as_uji_sdit_nusantara_2026")),
    ),
  },
  dev: {
    port: 3003,
  },
});

// Static government-portal mocks on their own hostnames: Ruang GTK is an allowed site (F2-3);
// e-Rapor is deliberately left off the allowed list (WS-1 case a).
export const mockRuangGtk = Cloudflare.Worker("mock-ruang-gtk", {
  assets: "../../apps/mock-portals/ruang-gtk",
  domain: isProd ? "nemu-ruang-gtk.ahargunyllib.dev" : undefined,
  dev: {
    port: 3004,
  },
});

export const mockErapor = Cloudflare.Worker("mock-erapor", {
  assets: "../../apps/mock-portals/erapor",
  domain: isProd ? "nemu-erapor.ahargunyllib.dev" : undefined,
  dev: {
    port: 3005,
  },
});

export default Alchemy.Stack(
  "nemu",
  {
    providers: Cloudflare.providers(),
    // `alchemy dev` keeps state in this checkout's .alchemy/ next to the local D1 data,
    // so a fresh worktree creates its database and applies migrations instead of
    // trusting a shared remote row that says another checkout already migrated.
    state: Layer.unwrap(
      Effect.gen(function* () {
        const { dev } = yield* Alchemy.AlchemyContext;
        return dev ? Alchemy.localState() : Cloudflare.state();
      }),
    ),
  },
  Effect.gen(function* () {
    const serverWorker = yield* server;
    const adminWorker = yield* Cloudflare.Website.Vite("admin", {
      rootDir: "../../apps/admin",
      domain: isProd ? "nemu-admin.ahargunyllib.dev" : undefined,
      assets: {
        htmlHandling: "auto-trailing-slash",
        notFoundHandling: "single-page-application",
      },
      env: {
        VITE_SERVER_URL: serverWorker.url.as<string>(),
      },
      dev: {
        port: 3002,
      },
    });

    const mockAlurSekolahWorker = yield* mockAlurSekolah;
    const mockRuangGtkWorker = yield* mockRuangGtk;
    const mockEraporWorker = yield* mockErapor;

    return {
      admin: adminWorker.url,
      server: serverWorker.url,
      mockAlurSekolah: mockAlurSekolahWorker.url,
      mockRuangGtk: mockRuangGtkWorker.url,
      mockErapor: mockEraporWorker.url,
    };
  }),
);
