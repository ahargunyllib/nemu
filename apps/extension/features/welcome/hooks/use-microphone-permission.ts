import { useCallback, useEffect, useState } from "react";

export type MicrophonePermission = "checking" | "prompt" | "granted" | "denied" | "unavailable";

/**
 * The extension's microphone permission, asked from an extension page so the offscreen document
 * may record later without asking on every school site.
 */
export function useMicrophonePermission() {
  const [permission, setPermission] = useState<MicrophonePermission>("checking");

  useEffect(() => {
    let status: PermissionStatus | null = null;
    const update = () => status && setPermission(status.state);
    navigator.permissions
      .query({ name: "microphone" as PermissionName })
      .then((result) => {
        status = result;
        update();
        result.addEventListener("change", update);
      })
      .catch(() => setPermission("prompt"));
    return () => status?.removeEventListener("change", update);
  }, []);

  const ask = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      for (const track of stream.getTracks()) track.stop();
      setPermission("granted");
    } catch (error) {
      setPermission(
        error instanceof DOMException && error.name === "NotAllowedError"
          ? "denied"
          : "unavailable",
      );
    }
  }, []);

  return { permission, ask };
}
