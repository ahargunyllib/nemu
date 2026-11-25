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
    OPENROUTER_GENERATOR_MODEL: Config.String("OPENROUTER_GENERATOR_MODEL"),
    OPENROUTER_REASONING_EFFORT: Config.String("OPENROUTER_REASONING_EFFORT"),
    OPENROUTER_JEV_MODEL: Config.String("OPENROUTER_JEV_MODEL"),
    NEMU_DEMO_DATE: Config.String("NEMU_DEMO_DATE"),
    OPENROUTER_SCHOOL_READ_A_MODEL: Config.String("OPENROUTER_SCHOOL_READ_A_MODEL").pipe(
      Config.withDefault("google/gemini-4-hydrogen"),
    ),
    OPENROUTER_SCHOOL_READ_B_MODEL: Config.String("OPENROUTER_SCHOOL_READ_B_MODEL").pipe(
      Config.withDefault("openai/gpt-6.1-terra"),
    ),
    OPENROUTER_SCHOOL_REREAD_MODEL: Config.String("OPENROUTER_SCHOOL_REREAD_MODEL").pipe(
      Config.withDefault("google/gemini-4-hydrogen"),
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
  },
  dev: {
    port: 3000,
  },
});

export type ServerEnv = Cloudflare.InferEnv<typeof server>;

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
    const webWorker = yield* Cloudflare.Website.Vite("web", {
      rootDir: "../../apps/mock-alurkerja",
      domain: isProd ? "nemu-mock-alurkerja.ahargunyllib.dev" : undefined,
      assets: {
        htmlHandling: "auto-trailing-slash",
        notFoundHandling: "single-page-application",
      },
      env: {
        VITE_SERVER_URL: serverWorker.url.as<string>(),
      },
      dev: {
        port: 3001,
      },
    });

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

    return {
      web: webWorker.url,
      admin: adminWorker.url,
      server: serverWorker.url,
    };
  }),
);
