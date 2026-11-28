import type { InboxDeps } from "../inbox/service";
import { enqueuePhoto, teacherForSender } from "../inbox/service";
import type { SchoolDirectory } from "../school/directory";

/**
 * F1-01 intake from `apps/wa-bot`. The bot asks `isRegisteredSender` before it downloads anything,
 * and the hand-off checks the number again so the bot can never queue a photo for a stranger.
 */

export type WhatsAppPhotoDeps = InboxDeps & { directory: SchoolDirectory };

export async function isRegisteredSender(
  directory: SchoolDirectory,
  phone: string,
): Promise<boolean> {
  return (await teacherForSender(directory, phone)) !== null;
}

export type WhatsAppPhotoInput = {
  phone: string;
  messageId: string;
  bytes: Uint8Array;
  thumbnail?: Uint8Array;
};

export type WhatsAppPhotoResult =
  | { status: "queued"; jobId: string }
  | { status: "unknown_sender" | "not_an_image" | "too_large" };

export async function receiveWhatsAppPhoto(
  deps: WhatsAppPhotoDeps,
  input: WhatsAppPhotoInput,
): Promise<WhatsAppPhotoResult> {
  const teacher = await teacherForSender(deps.directory, input.phone);
  if (!teacher) return { status: "unknown_sender" };
  const result = await enqueuePhoto(
    { store: deps.store },
    {
      teacherId: teacher.teacherId,
      source: "whatsapp",
      bytes: input.bytes,
      messageId: input.messageId,
      thumbnail: input.thumbnail,
    },
  );
  return result.status === "queued"
    ? { status: "queued", jobId: result.job.jobId }
    : { status: result.status };
}
