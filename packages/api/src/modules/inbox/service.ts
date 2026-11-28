import { imageMimeType, stripJpegMetadata } from "@nemu/ai/school/image";
import { imageDataUrl } from "@nemu/ai/school/llm";
import { buildVerificationPlan } from "@nemu/ai/school/grades/verification";
import type { TeacherProfile } from "@nemu/ai/school/profile";
import type { SchoolAi } from "@nemu/ai/school/runtime";
import {
  inboxJobSchema,
  photoTitleSchema,
  type InboxJob,
  type PhotoTitle,
} from "@nemu/contracts/school";

import type { InboxFileStore } from "../../context";
import type { SchoolDirectory } from "../school/directory";

/**
 * F1-01 photo jobs (AI_TECHNICAL_PRD §3.0). A photo from the teacher's WhatsApp number or an
 * upload is stored under `inbox/<teacher>/<job>/` with its job state; the laptop lists jobs and asks
 * for one to be read; acknowledging deletes everything. The bucket's 1-day lifecycle rule removes
 * anything left behind. No grade value or name is logged.
 */

export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
/** The bot's thumbnail is about 320 px on its long side; anything bigger isn't one. */
export const MAX_THUMBNAIL_BYTES = 256 * 1024;
/** A job still "processing" after this long is assumed abandoned and may be read again. */
const PROCESSING_TIMEOUT_MS = 3 * 60_000;

export type InboxDeps = { store: InboxFileStore };

type StoredJob = InboxJob & {
  teacherId: string;
  contentType: string;
  /** #278: the card's thumbnail beside the photo; absent when the bot sent none. */
  thumbnailType?: string;
  updatedAt: number;
};

function prefixFor(teacherId: string): string {
  return `inbox/${encodeURIComponent(teacherId)}/`;
}

function jobKey(teacherId: string, jobId: string): string {
  return `${prefixFor(teacherId)}${jobId}/job.json`;
}

function photoKey(teacherId: string, jobId: string): string {
  return `${prefixFor(teacherId)}${jobId}/photo`;
}

function thumbnailKey(teacherId: string, jobId: string): string {
  return `${prefixFor(teacherId)}${jobId}/thumbnail`;
}

async function readJob(
  store: InboxFileStore,
  teacherId: string,
  jobId: string,
): Promise<StoredJob | null> {
  const body = await store.get(jobKey(teacherId, jobId));
  if (!body) return null;
  return JSON.parse(new TextDecoder().decode(body)) as StoredJob;
}

async function writeJob(store: InboxFileStore, job: StoredJob): Promise<void> {
  const bytes = new TextEncoder().encode(JSON.stringify(job));
  await store.put(
    jobKey(job.teacherId, job.jobId),
    bytes.buffer as ArrayBuffer,
    "application/json",
  );
}

function publicJob(job: StoredJob): InboxJob {
  return inboxJobSchema.parse({
    jobId: job.jobId,
    source: job.source,
    status: job.status,
    createdAt: job.createdAt,
    reading: job.reading,
    verification: job.verification,
    message: job.message,
  });
}

async function stableJobId(messageId: string): Promise<string> {
  const digest = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(messageId)),
  );
  return [...digest.subarray(0, 12)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export type EnqueuePhotoInput = {
  teacherId: string;
  source: "whatsapp" | "upload";
  bytes: Uint8Array;
  /** WhatsApp message id: the same message enqueued twice (webhook retry) is one job. */
  messageId?: string;
  /**
   * #278: a small copy for the "Foto dari WhatsApp" card, made by `apps/wa-bot` at hand-off. One
   * that isn't a small image is dropped; the photo is queued either way.
   */
  thumbnail?: Uint8Array;
  now?: number;
};

export type EnqueueResult =
  | { status: "queued"; job: InboxJob }
  | { status: "not_an_image" | "too_large" };

export async function enqueuePhoto(
  { store }: InboxDeps,
  input: EnqueuePhotoInput,
): Promise<EnqueueResult> {
  if (input.bytes.byteLength > MAX_PHOTO_BYTES) return { status: "too_large" };
  const contentType = imageMimeType(input.bytes);
  if (!contentType) return { status: "not_an_image" };

  const jobId = input.messageId ? await stableJobId(input.messageId) : crypto.randomUUID();
  const existing = await readJob(store, input.teacherId, jobId);
  if (existing) return { status: "queued", job: publicJob(existing) };

  const clean = stripJpegMetadata(input.bytes);
  await store.put(
    photoKey(input.teacherId, jobId),
    clean.slice().buffer as ArrayBuffer,
    contentType,
  );
  const thumbnailType =
    input.thumbnail && input.thumbnail.byteLength <= MAX_THUMBNAIL_BYTES
      ? imageMimeType(input.thumbnail)
      : null;
  if (input.thumbnail && thumbnailType)
    await store.put(
      thumbnailKey(input.teacherId, jobId),
      stripJpegMetadata(input.thumbnail).slice().buffer as ArrayBuffer,
      thumbnailType,
    );
  const now = input.now ?? Date.now();
  const job: StoredJob = {
    jobId,
    teacherId: input.teacherId,
    source: input.source,
    status: "queued",
    createdAt: now,
    updatedAt: now,
    reading: null,
    verification: null,
    message: null,
    contentType,
    ...(thumbnailType ? { thumbnailType } : {}),
  };
  await writeJob(store, job);
  return { status: "queued", job: publicJob(job) };
}

/**
 * For the WhatsApp webhook (fullstack side): call `teacherForSender` BEFORE downloading the media,
 * and drop the message when it returns null (F1-01: unknown numbers are refused).
 */
export async function teacherForSender(
  directory: SchoolDirectory,
  fromPhone: string,
): Promise<TeacherProfile | null> {
  return directory.teacherByPhone(fromPhone);
}

export async function listJobs({ store }: InboxDeps, teacherId: string): Promise<InboxJob[]> {
  const keys = await store.list(prefixFor(teacherId));
  const jobIds = [
    ...new Set(
      keys.filter((key) => key.endsWith("/job.json")).map((key) => key.split("/").at(-2)!),
    ),
  ];
  const jobs = await Promise.all(jobIds.map((jobId) => readJob(store, teacherId, jobId)));
  return jobs
    .filter((job): job is StoredJob => !!job)
    .sort((left, right) => right.createdAt - left.createdAt)
    .map(publicJob);
}

/**
 * #269: the photo's heading as choices for "Ini nilai apa, Bu?" (#270), before the full read. The
 * job stays as it is; null when the job or its photo isn't this teacher's (or is gone).
 */
export async function readTitle(
  deps: InboxDeps & { ai: Pick<SchoolAi, "readPhotoTitle"> },
  input: { teacherId: string; jobId: string },
): Promise<PhotoTitle | null> {
  const job = await readJob(deps.store, input.teacherId, input.jobId);
  if (!job) return null;
  const photo = await deps.store.get(photoKey(input.teacherId, input.jobId));
  if (!photo) return null;
  const candidates = await deps.ai.readPhotoTitle({
    image: { type: "image", dataUrl: imageDataUrl(new Uint8Array(photo), job.contentType) },
  });
  return photoTitleSchema.parse({ candidates: candidates.slice(0, 3) });
}

export type ProcessJobInput = {
  teacherId: string;
  jobId: string;
  className: string;
  assessment: string | null;
  now?: number;
};

export type ProcessJobDeps = InboxDeps & {
  ai: Pick<SchoolAi, "readGradePhoto">;
  directory: SchoolDirectory;
};

/** Reads the photo (25–40 s with the real models). Re-reading a finished job returns it as is. */
export async function processJob(
  deps: ProcessJobDeps,
  input: ProcessJobInput,
): Promise<InboxJob | null> {
  const job = await readJob(deps.store, input.teacherId, input.jobId);
  if (!job) return null;
  const now = input.now ?? Date.now();
  if (job.status === "ready" || job.status === "reshoot") return publicJob(job);
  if (job.status === "processing" && now - job.updatedAt < PROCESSING_TIMEOUT_MS)
    return publicJob(job);

  const roster = await deps.directory.roster(input.teacherId, input.className);
  if (!roster.length) {
    const failed: StoredJob = {
      ...job,
      status: "failed",
      updatedAt: now,
      message: `Daftar siswa kelas ${input.className} belum ada di Nemu.`,
    };
    await writeJob(deps.store, failed);
    return publicJob(failed);
  }
  const photo = await deps.store.get(photoKey(input.teacherId, input.jobId));
  if (!photo) {
    const failed: StoredJob = {
      ...job,
      status: "failed",
      updatedAt: now,
      message: "Fotonya sudah terhapus. Kirim ulang, ya.",
    };
    await writeJob(deps.store, failed);
    return publicJob(failed);
  }

  await writeJob(deps.store, { ...job, status: "processing", updatedAt: now });
  try {
    const result = await deps.ai.readGradePhoto({
      image: { type: "image", dataUrl: imageDataUrl(new Uint8Array(photo), job.contentType) },
      roster,
      assessment: input.assessment,
    });
    const done: StoredJob =
      result.status === "ok"
        ? {
            ...job,
            status: "ready",
            updatedAt: Date.now(),
            reading: result.reading,
            verification: buildVerificationPlan(result.reading),
            message: null,
          }
        : { ...job, status: "reshoot", updatedAt: Date.now(), message: result.sentence };
    await writeJob(deps.store, done);
    return publicJob(done);
  } catch (error) {
    await writeJob(deps.store, {
      ...job,
      status: "failed",
      updatedAt: Date.now(),
      message: "Foto belum bisa dibaca sekarang. Coba lagi sebentar, ya.",
    });
    throw error;
  }
}

/** The photo itself, for cropping the cell a verification question is about (W5). */
export async function jobPhoto(
  { store }: InboxDeps,
  teacherId: string,
  jobId: string,
): Promise<{ body: ArrayBuffer; contentType: string } | null> {
  const job = await readJob(store, teacherId, jobId);
  if (!job) return null;
  const body = await store.get(photoKey(teacherId, jobId));
  return body ? { body, contentType: job.contentType } : null;
}

/**
 * #278: the "Foto dari WhatsApp" card's thumbnail, before the teacher presses Mulai. Serving it
 * reads nothing and leaves the job as it is; null when the job isn't this teacher's, is gone, or
 * came without one.
 */
export async function jobThumbnail(
  { store }: InboxDeps,
  teacherId: string,
  jobId: string,
): Promise<{ body: ArrayBuffer; contentType: string } | null> {
  const job = await readJob(store, teacherId, jobId);
  if (!job?.thumbnailType) return null;
  const body = await store.get(thumbnailKey(teacherId, jobId));
  return body ? { body, contentType: job.thumbnailType } : null;
}

/**
 * The teacher saved (or gave up): delete the photo, its thumbnail and the job (UU PDP: delete
 * after processing, F1-12).
 */
export async function ackJob(
  { store }: InboxDeps,
  teacherId: string,
  jobId: string,
): Promise<boolean> {
  const job = await readJob(store, teacherId, jobId);
  if (!job) return false;
  await Promise.all([
    store.delete(photoKey(teacherId, jobId)),
    store.delete(thumbnailKey(teacherId, jobId)),
    store.delete(jobKey(teacherId, jobId)),
  ]);
  return true;
}
