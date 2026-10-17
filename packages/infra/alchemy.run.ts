import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import "varlock/auto-load";

// Custom domains belong to prod only; personal dev_* stages stay on workers.dev.
const isProd = process.env.ALCHEMY_STAGE === "prod";

export const db = Cloudflare.D1.Database("database", {
  migrations: "../../packages/db/src/migrations",
});

export const server = Cloudflare.Worker("server", {
  main: "../../apps/server/src/index.ts",
  domain: isProd ? "nemu-api.ahargunyllib.dev" : undefined,
  compatibility: {
    flags: ["nodejs_compat"],
  },
  env: {
    DB: db,
    CORS_ORIGIN: Config.String("CORS_ORIGIN"),
    BETTER_AUTH_SECRET: Config.Redacted("BETTER_AUTH_SECRET"),
    BETTER_AUTH_URL: Cloudflare.Worker.URL,
    OPENROUTER_API_KEY: Config.Redacted("OPENROUTER_API_KEY"),
    OPENROUTER_GENERATOR_MODEL: Config.String("OPENROUTER_GENERATOR_MODEL"),
    OPENROUTER_REASONING_EFFORT: Config.String("OPENROUTER_REASONING_EFFORT"),
    OPENROUTER_JEV_MODEL: Config.String("OPENROUTER_JEV_MODEL"),
    NEMU_DEMO_DATE: Config.String("NEMU_DEMO_DATE"),
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
    state: Cloudflare.state(),
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
