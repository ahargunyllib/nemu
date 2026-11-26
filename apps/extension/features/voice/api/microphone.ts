import { browser } from "wxt/browser";

import type { OffscreenMessage, RecordStart, Recording } from "../../../shared/lib/messages";

/**
 * Background: the microphone lives in an offscreen document (`USER_MEDIA`), so its permission
 * belongs to the extension and is asked once, on the welcome page, not on every school site.
 */
const OFFSCREEN_PATH = "/offscreen.html";

let creating: Promise<void> | null = null;

async function ensureOffscreen() {
  const contexts = await browser.runtime.getContexts({
    contextTypes: [browser.runtime.ContextType.OFFSCREEN_DOCUMENT],
    documentUrls: [browser.runtime.getURL(OFFSCREEN_PATH)],
  });
  if (contexts.length > 0) return;
  creating ??= browser.offscreen
    .createDocument({
      url: OFFSCREEN_PATH,
      reasons: [browser.offscreen.Reason.USER_MEDIA],
      justification: "Merekam suara guru selama tombol bicara Nemu ditahan.",
    })
    .finally(() => {
      creating = null;
    });
  await creating;
}

async function toOffscreen<Result>(type: OffscreenMessage["type"]): Promise<Result> {
  await ensureOffscreen();
  const message: OffscreenMessage = { target: "nemu-offscreen", type };
  return (await browser.runtime.sendMessage(message)) as Result;
}

let welcomeOpenedAt = 0;

/** Opens the welcome page, where the teacher allows the microphone; at most once a minute. */
async function openWelcomePage() {
  if (Date.now() - welcomeOpenedAt < 60_000) return;
  welcomeOpenedAt = Date.now();
  await browser.tabs.create({ url: browser.runtime.getURL("/welcome.html") });
}

export const MICROPHONE_DENIED =
  "Nemu belum boleh memakai mikrofon. Izinkan di halaman Nemu yang baru terbuka, lalu coba lagi.";
export const MICROPHONE_UNAVAILABLE =
  "Mikrofon tidak bisa dipakai. Periksa mikrofon komputer, lalu coba lagi.";

export async function startRecording(): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const started = await toOffscreen<RecordStart>("record-start");
    if (started === "recording") return { ok: true };
    if (started === "denied") {
      await openWelcomePage();
      return { ok: false, message: MICROPHONE_DENIED };
    }
  } catch (error) {
    console.warn("[nemu] could not start the microphone", error);
  }
  return { ok: false, message: MICROPHONE_UNAVAILABLE };
}

export async function stopRecording(): Promise<Recording> {
  try {
    return await toOffscreen<Recording>("record-stop");
  } catch (error) {
    console.warn("[nemu] could not stop the microphone", error);
    return null;
  }
}

export async function cancelRecording(): Promise<void> {
  await toOffscreen("record-cancel").catch(() => undefined);
}
