import { z } from "zod";

import { waBotProcedure } from "../../index";
import { isRegisteredSender, receiveWhatsAppPhoto } from "./service";

const phoneSchema = z.string().trim().min(5).max(32);

/**
 * Called by `apps/wa-bot` over the OpenAPI handler (`POST /api-reference/wa-bot/...`) with
 * `Authorization: Bearer <WA_BOT_SECRET>`. Phone numbers and grade photos are never logged.
 */
export const waBotRouter = {
  /** Asked before the bot downloads a photo: unknown numbers are ignored (F1-01). */
  waBotSender: waBotProcedure
    .route({ method: "POST", path: "/wa-bot/sender" })
    .input(z.object({ phone: phoneSchema }))
    .handler(async ({ context, input }) => ({
      registered: await isRegisteredSender(context.school.directory, input.phone),
    })),

  /**
   * The downloaded photo and the bot's thumbnail of it, as multipart form data. The same
   * `messageId` twice is one job.
   */
  waBotPhoto: waBotProcedure
    .route({ method: "POST", path: "/wa-bot/photos" })
    .input(
      z.object({
        phone: phoneSchema,
        messageId: z.string().trim().min(1).max(128),
        photo: z.instanceof(File),
        /** #278: the bot's small JPEG for the extension's photo card (optional). */
        thumbnail: z.instanceof(File).optional(),
      }),
    )
    .handler(async ({ context, input }) =>
      receiveWhatsAppPhoto(
        { store: context.school.inbox, directory: context.school.directory },
        {
          phone: input.phone,
          messageId: input.messageId,
          bytes: new Uint8Array(await input.photo.arrayBuffer()),
          thumbnail: input.thumbnail
            ? new Uint8Array(await input.thumbnail.arrayBuffer())
            : undefined,
        },
      ),
    ),
};
