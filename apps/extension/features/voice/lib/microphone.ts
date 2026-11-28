import type { RecordStart } from "../../../shared/lib/messages";

/**
 * What a hold did with the microphone. `allowed`: Chrome asked for the first time and the teacher
 * allowed it, so nothing was recorded this time. `blocked`: the site may not use it until she
 * allows it again. `dismissed`: she closed Chrome's prompt without choosing.
 */
export type MicrophoneStart = "recording" | "allowed" | "blocked" | "dismissed" | "unavailable";

/** The page's microphone permission, live: its state changes and says so. */
type Permission = Pick<PermissionStatus, "state" | "addEventListener" | "removeEventListener">;

export type MicrophoneDeps = {
  /** The page's microphone permission, or null where the browser can't say. */
  permission: () => Promise<Permission | null>;
  /** Opens the microphone; Chrome shows its prompt when the site hasn't been allowed yet. */
  open: () => Promise<MediaStream>;
  recorder: { start: () => Promise<RecordStart> };
};

export function isRefusal(error: unknown): boolean {
  return error instanceof DOMException && error.name === "NotAllowedError";
}

/**
 * Content script: starts recording a hold on this site (ADR-0019). The microphone belongs to the
 * site, so the first hold makes Chrome ask under the address bar; `onAsking` lets Nemu point at
 * Izinkan until she answers. A blocked microphone isn't asked for, since Chrome would refuse at
 * once; she gets the steps to allow it instead.
 */
export async function startMicrophone(
  deps: MicrophoneDeps,
  onAsking: () => void,
): Promise<MicrophoneStart> {
  const status = await deps.permission();
  if (status?.state === "denied") return "blocked";
  if (status?.state === "prompt") return askOnce(deps, status, onAsking);
  const started = await deps.recorder.start();
  if (started === "recording") return "recording";
  return started === "denied" ? "blocked" : "unavailable";
}

function askOnce(
  deps: MicrophoneDeps,
  status: Permission,
  onAsking: () => void,
): Promise<MicrophoneStart> {
  return new Promise((resolve) => {
    let settled = false;
    const settle = (outcome: MicrophoneStart) => {
      if (settled) return;
      settled = true;
      status.removeEventListener("change", onChange);
      resolve(outcome);
    };
    // She may answer some other way, such as the site settings, while the prompt is still up.
    const onChange = () => {
      if (status.state === "granted") settle("allowed");
      else if (status.state === "denied") settle("blocked");
    };
    status.addEventListener("change", onChange);
    onAsking();
    deps.open().then(
      (stream) => {
        for (const track of stream.getTracks()) track.stop();
        settle("allowed");
      },
      (error: unknown) => {
        if (!isRefusal(error)) settle("unavailable");
        else settle(status.state === "denied" ? "blocked" : "dismissed");
      },
    );
  });
}
