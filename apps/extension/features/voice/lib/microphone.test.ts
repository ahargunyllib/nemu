import { describe, expect, test, vi } from "vite-plus/test";

import type { RecordStart } from "../../../shared/lib/messages";
import { type MicrophoneDeps, startMicrophone } from "./microphone";

/** The page's microphone permission as Chrome reports it, changeable like the real one. */
class FakePermission extends EventTarget {
  constructor(public state: PermissionState) {
    super();
  }
  set(state: PermissionState) {
    this.state = state;
    this.dispatchEvent(new Event("change"));
  }
}

function refusal() {
  return new DOMException("Permission denied", "NotAllowedError");
}

function fakeStream() {
  const stop = vi.fn();
  return { stream: { getTracks: () => [{ stop }] } as unknown as MediaStream, stop };
}

function deps(
  permission: FakePermission | null,
  overrides: Partial<Pick<MicrophoneDeps, "open">> & { record?: RecordStart } = {},
) {
  const record = vi.fn(async () => overrides.record ?? "recording");
  const open = overrides.open ?? vi.fn(async () => fakeStream().stream);
  const value: MicrophoneDeps = {
    permission: async () => permission,
    open,
    recorder: { start: record },
  };
  return { value, record, open };
}

describe("startMicrophone", () => {
  test("an allowed microphone records at once, without pointing", async () => {
    const onAsking = vi.fn();
    const { value, record } = deps(new FakePermission("granted"));
    expect(await startMicrophone(value, onAsking)).toBe("recording");
    expect(record).toHaveBeenCalledOnce();
    expect(onAsking).not.toHaveBeenCalled();
  });

  test("the first time, Nemu points while Chrome asks, then says it is allowed without recording", async () => {
    const onAsking = vi.fn();
    const { stream, stop } = fakeStream();
    const { value, record } = deps(new FakePermission("prompt"), { open: async () => stream });
    expect(await startMicrophone(value, onAsking)).toBe("allowed");
    expect(onAsking).toHaveBeenCalledOnce();
    expect(stop).toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
  });

  test("allowing it another way while Chrome still asks counts too", async () => {
    const permission = new FakePermission("prompt");
    const { value } = deps(permission, { open: () => new Promise<MediaStream>(() => {}) });
    const started = startMicrophone(value, () => permission.set("granted"));
    expect(await started).toBe("allowed");
  });

  test("choosing Jangan izinkan in Chrome's prompt shows the blocked steps", async () => {
    const permission = new FakePermission("prompt");
    const { value } = deps(permission, {
      open: async () => {
        permission.state = "denied";
        throw refusal();
      },
    });
    expect(await startMicrophone(value, () => {})).toBe("blocked");
  });

  test("closing Chrome's prompt without choosing leaves it to ask again", async () => {
    const { value } = deps(new FakePermission("prompt"), {
      open: async () => {
        throw refusal();
      },
    });
    expect(await startMicrophone(value, () => {})).toBe("dismissed");
  });

  test("a blocked microphone shows the steps without asking or recording", async () => {
    const onAsking = vi.fn();
    const { value, record, open } = deps(new FakePermission("denied"));
    expect(await startMicrophone(value, onAsking)).toBe("blocked");
    expect(onAsking).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
  });

  test("no microphone on the computer is unavailable", async () => {
    const { value } = deps(new FakePermission("prompt"), {
      open: async () => {
        throw new DOMException("Requested device not found", "NotFoundError");
      },
    });
    expect(await startMicrophone(value, () => {})).toBe("unavailable");
    const recorderFails = deps(new FakePermission("granted"), { record: "unavailable" });
    expect(await startMicrophone(recorderFails.value, () => {})).toBe("unavailable");
  });

  test("a permission blocked between the check and the recording shows the steps", async () => {
    const { value } = deps(new FakePermission("granted"), { record: "denied" });
    expect(await startMicrophone(value, () => {})).toBe("blocked");
  });
});
