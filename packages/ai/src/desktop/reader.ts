import type { ScreenElement, ScreenSnapshot } from "@nemu/contracts/school";

/**
 * Nemu's screen reading for F2 and guided pointing (AI_TECHNICAL_PRD §5.1). Runs in the desktop
 * app's main process. Platform pieces are injected, so the same logic serves Windows now and
 * macOS later, and tests run anywhere. It never collects input values, and it captures nothing
 * while a password field or a login/OTP screen is showing.
 */

export type WindowBounds = { x: number; y: number; width: number; height: number };

export type ForegroundWindow = {
  title: string;
  bounds: WindowBounds;
  /** Executable name, e.g. "chrome.exe" or "WhatsApp.exe". */
  processName: string;
};

/** What an accessibility source (UIA on Windows, the extension in a web page) reports. */
export type AccessibleText = {
  url: string | null;
  texts: string[];
  elements: ScreenElement[];
  hasPasswordField: boolean;
};

export type ScreenPlatform = {
  foregroundWindow(): Promise<ForegroundWindow | null>;
  /** JPEG of the given screen area, already downscaled to `maxSide` px on its longest side. */
  capture(bounds: WindowBounds, maxSide: number): Promise<Uint8Array>;
  /** UI Automation (Windows) or AX (macOS) text of the foreground window; null if unavailable. */
  accessibleText(): Promise<AccessibleText | null>;
  /** The Nemu extension's `getPageText()` for the active browser tab; null outside the browser. */
  pageText?(): Promise<AccessibleText | null>;
};

const LOGIN_TITLE =
  /\b(login|log in|masuk|sign in|signin|otp|autentikator|authenticator|kata sandi|password|verifikasi 2 langkah)\b/iu;
const BROWSERS = /^(chrome|msedge|firefox|brave|opera|arc)(\.exe)?$/iu;
const MAX_TEXTS = 200;
const MAX_ELEMENTS = 300;

export type PrivacyDecision =
  | { blocked: false }
  | { blocked: true; reason: "password_field" | "login_title" };

/** Pure: whether this screen may be read at all. */
export function privacyDecision(
  window: Pick<ForegroundWindow, "title">,
  sources: ReadonlyArray<AccessibleText | null>,
): PrivacyDecision {
  if (sources.some((source) => source?.hasPasswordField))
    return { blocked: true, reason: "password_field" };
  if (LOGIN_TITLE.test(window.title)) return { blocked: true, reason: "login_title" };
  return { blocked: false };
}

function clean(text: string): string {
  return text.replace(/\s+/gu, " ").trim().slice(0, 2_000);
}

/** Pure: merge sources, page text first (exact DOM strings), drop duplicates and empty lines. */
export function mergeTexts(sources: ReadonlyArray<AccessibleText | null>): {
  texts: string[];
  elements: ScreenElement[];
  url: string | null;
} {
  const seen = new Set<string>();
  const texts: string[] = [];
  const elements: ScreenElement[] = [];
  let url: string | null = null;
  for (const source of sources) {
    if (!source) continue;
    url ??= source.url;
    for (const text of source.texts) {
      const value = clean(text);
      if (value && !seen.has(value) && texts.length < MAX_TEXTS) {
        seen.add(value);
        texts.push(value);
      }
    }
    for (const element of source.elements) {
      if (elements.length < MAX_ELEMENTS && element.name.trim())
        elements.push({ ...element, name: clean(element.name) });
    }
  }
  return { texts, elements, url };
}

export type ScreenReader = {
  /**
   * Call on F8 key-down. Starts the capture at once (the teacher is still talking) and returns
   * the snapshot when it is ready; upload it while the speech is being transcribed.
   */
  readActiveWindow(): Promise<ScreenSnapshot>;
};

export type ScreenReaderOptions = { maxSide?: number };

function base64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

export function createScreenReader(
  platform: ScreenPlatform,
  options: ScreenReaderOptions = {},
): ScreenReader {
  const maxSide = options.maxSide ?? 1280;
  return {
    async readActiveWindow() {
      const window = await platform.foregroundWindow();
      if (!window) {
        return {
          title: "",
          url: null,
          texts: [],
          elements: [],
          screenshotBase64: null,
          blocked: false,
          blockedReason: null,
        };
      }
      const inBrowser = BROWSERS.test(window.processName);
      const [page, accessible] = await Promise.all([
        inBrowser && platform.pageText
          ? platform.pageText().catch(() => null)
          : Promise.resolve(null),
        platform.accessibleText().catch(() => null),
      ]);

      const decision = privacyDecision(window, [page, accessible]);
      if (decision.blocked) {
        return {
          title: window.title.slice(0, 500),
          url: null,
          texts: [],
          elements: [],
          screenshotBase64: null,
          blocked: true,
          blockedReason: decision.reason,
        };
      }

      const merged = mergeTexts([page, accessible]);
      const screenshot = await platform.capture(window.bounds, maxSide).catch(() => null);
      return {
        title: window.title.slice(0, 500),
        url: merged.url,
        texts: merged.texts,
        elements: merged.elements,
        screenshotBase64: screenshot ? base64(screenshot) : null,
        blocked: false,
        blockedReason: null,
      };
    },
  };
}
