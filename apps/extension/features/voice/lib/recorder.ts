import type { RecordStart, Recording } from "../../../shared/lib/messages";
import { isRefusal } from "./microphone";
import { bytesToBase64, encodeWav, mixToMono, TRANSCRIBE_SAMPLE_RATE } from "./wav";

/** `speechTranscribe` takes at most 15 s; a longer hold keeps the first 15 s. */
const MAX_RECORDING_MS = 15_000;

type Session = {
  recorder: MediaRecorder;
  stream: MediaStream;
  stopped: Promise<Blob>;
  timer: ReturnType<typeof setTimeout>;
};

/** Decodes the recording and re-encodes it as 16 kHz mono WAV (docs/school-ai.md). */
async function toTranscribable(blob: Blob): Promise<Recording> {
  const bytes = await blob.arrayBuffer();
  try {
    const context = new AudioContext({ sampleRate: TRANSCRIBE_SAMPLE_RATE });
    const buffer = await context.decodeAudioData(bytes.slice(0));
    void context.close();
    const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) =>
      buffer.getChannelData(i),
    );
    return {
      audioBase64: bytesToBase64(encodeWav(mixToMono(channels), buffer.sampleRate)),
      format: "wav",
    };
  } catch {
    return { audioBase64: bytesToBase64(new Uint8Array(bytes)), format: "webm" };
  }
}

/** Content script: records the site's microphone between `start` and `stop` (ADR-0019). */
export function createRecorder() {
  let session: Session | null = null;
  let starting: Promise<RecordStart> = Promise.resolve("unavailable");

  async function open(): Promise<RecordStart> {
    if (session) return "recording";
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
    } catch (error) {
      return isRefusal(error) ? "denied" : "unavailable";
    }
    const recorder = new MediaRecorder(stream);
    const chunks: Blob[] = [];
    recorder.ondataavailable = (event) => chunks.push(event.data);
    const stopped = new Promise<Blob>((resolve) => {
      recorder.onstop = () => resolve(new Blob(chunks, { type: recorder.mimeType }));
    });
    recorder.start();
    const timer = setTimeout(() => {
      if (recorder.state === "recording") recorder.stop();
    }, MAX_RECORDING_MS);
    session = { recorder, stream, stopped, timer };
    return "recording";
  }

  async function finish(keep: boolean): Promise<Recording> {
    await starting;
    const current = session;
    session = null;
    if (!current) return null;
    clearTimeout(current.timer);
    if (current.recorder.state !== "inactive") current.recorder.stop();
    const blob = await current.stopped;
    for (const track of current.stream.getTracks()) track.stop();
    return keep && blob.size > 0 ? toTranscribable(blob) : null;
  }

  return {
    start(): Promise<RecordStart> {
      starting = open();
      return starting;
    },
    stop: () => finish(true),
    cancel: () => finish(false),
  };
}
