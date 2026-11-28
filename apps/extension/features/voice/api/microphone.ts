import { createRecorder } from "../lib/recorder";
import { type MicrophoneStart, startMicrophone } from "../lib/microphone";
import type { Recording } from "../../../shared/lib/messages";

/** Content script: the site's microphone, recorded on the page itself (ADR-0019). */
const recorder = createRecorder();

export const MICROPHONE_UNAVAILABLE =
  "Mikrofon tidak bisa dipakai. Periksa mikrofon komputer, lalu coba lagi.";

/** Starts recording a hold; the first time on a site, `onAsking` fires while Chrome asks. */
export function startListening(onAsking: () => void): Promise<MicrophoneStart> {
  return startMicrophone(
    {
      permission: () =>
        navigator.permissions.query({ name: "microphone" as PermissionName }).catch(() => null),
      open: () => navigator.mediaDevices.getUserMedia({ audio: true }),
      recorder,
    },
    onAsking,
  ).catch((error: unknown) => {
    console.warn("[nemu] could not start the microphone", error);
    return "unavailable" as const;
  });
}

export function stopListening(): Promise<Recording> {
  return recorder.stop().catch((error: unknown) => {
    console.warn("[nemu] could not stop the microphone", error);
    return null;
  });
}

export function cancelListening(): Promise<void> {
  return recorder.cancel().then(
    () => undefined,
    () => undefined,
  );
}
