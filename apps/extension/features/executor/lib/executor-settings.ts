import {
  type Cara as SchoolCara,
  DEFAULT_SCHOOL_SETTINGS,
  FILL_INTERVAL_MS,
  type SitePermission,
  sitePermissionFor,
} from "@nemu/contracts/extension";

import type { TalkShortcut } from "@nemu/contracts/talk-shortcut";

import type { SiteConfig } from "../../../shared/lib/extension-storage";
import { talkShortcutFrom } from "../../voice/lib/talk-shortcut";
import type { Cara } from "./run-notes";

/**
 * How the executor works on this page: the school's default cara and cara 1 fill speed (WS-08),
 * and what the site lets Nemu do (WS-03).
 */
export type ExecutorSettings = {
  cara: Cara;
  fieldsPerSecond: number;
  permission: SitePermission;
  /** Held to talk; pressing it pauses Nemu instead of counting as the teacher's input. */
  talkShortcut: TalkShortcut;
};

/** Cara 1 at about one field per second (PRD §6.1), on a site where Nemu may read and fill. */
export const DEFAULT_EXECUTOR_SETTINGS: ExecutorSettings = {
  cara: 1,
  fieldsPerSecond: 1,
  permission: "read_fill",
  talkShortcut: talkShortcutFrom(undefined),
};

const CARA_NUMBER: Record<SchoolCara, Cara> = { isi: 1, tunjuk: 2, cek: 3 };

/**
 * The one place the executor reads its settings: the school's WS-08 settings and the WS-03
 * permission of the page at `url`, from the config the background last read (`extensionConfig`).
 * A config cached before WS-08 falls back to cara 1 at normal speed. A page off the list never
 * runs the executor, so "read_fill" there is only the type's fallback.
 */
export function executorSettings(config: SiteConfig | null, url?: string): ExecutorSettings {
  const settings = config?.settings ?? DEFAULT_SCHOOL_SETTINGS;
  return {
    cara: CARA_NUMBER[settings.defaultCara],
    fieldsPerSecond: 1000 / FILL_INTERVAL_MS[settings.fillSpeed],
    permission: sitePermissionFor(config?.allowedSites ?? [], url) ?? "read_fill",
    talkShortcut: talkShortcutFrom(settings.talkShortcut),
  };
}
