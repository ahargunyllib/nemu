import type { SiteConfig } from "../../../shared/lib/extension-storage";
import type { Cara } from "./run-notes";

/** How the executor works for this school: the default cara and the cara 1 fill speed. */
export type ExecutorSettings = { cara: Cara; fieldsPerSecond: number };

/** Cara 1 at about one field per second (PRD §6.1). */
export const DEFAULT_EXECUTOR_SETTINGS: ExecutorSettings = { cara: 1, fieldsPerSecond: 1 };

/**
 * The one place the executor reads its settings. WS-08 (#212) will send the school's default cara
 * and fill speed in `extensionConfig`; once it does, read them from `config` here.
 */
export function executorSettings(_config: SiteConfig | null): ExecutorSettings {
  return DEFAULT_EXECUTOR_SETTINGS;
}
