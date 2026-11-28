import { ORPCError } from "@orpc/server";
import { z } from "zod";

import { schoolProcedure } from "../../index";
import {
  MAX_PHOTO_BYTES,
  ackJob,
  enqueuePhoto,
  jobPhoto,
  jobThumbnail,
  listJobs,
  processJob,
  readTitle,
} from "./service";

const jobIdSchema = z.object({ jobId: z.string().min(1).max(80) });

export const inboxRouter = {
  /** A photo from the laptop or the QR upload page (WhatsApp photos come through `waBotPhoto`). */
  inboxUploadPhoto: schoolProcedure
    .input(
      z.object({
        file: z
          .instanceof(File)
          .refine((file) => file.size <= MAX_PHOTO_BYTES, "Upload a photo no larger than 8 MB"),
      }),
    )
    .handler(async ({ context, input }) => {
      const teacher = await context.caller.requireTeacher();
      const result = await enqueuePhoto(
        { store: context.school.inbox },
        {
          teacherId: teacher.teacherId,
          source: "upload",
          bytes: new Uint8Array(await input.file.arrayBuffer()),
        },
      );
      if (result.status === "queued") return result.job;
      throw new ORPCError("BAD_REQUEST", {
        message:
          result.status === "too_large"
            ? "Upload a photo no larger than 8 MB"
            : "Upload a JPEG, PNG or WebP photo",
      });
    }),

  /** Jobs waiting for this teacher, newest first. The laptop polls this while Nemu is open. */
  inboxJobs: schoolProcedure.handler(async ({ context }) => {
    const teacher = await context.caller.requireTeacher();
    return listJobs({ store: context.school.inbox }, teacher.teacherId);
  }),

  /**
   * #269: the photo's heading as up to 3 {assessment, subject, className} candidates, for the
   * extension's "Ini nilai apa, Bu?" (#270). Empty when the heading can't be read.
   */
  inboxReadTitle: schoolProcedure.input(jobIdSchema).handler(async ({ context, input }) => {
    const teacher = await context.caller.requireTeacher();
    const title = await readTitle(
      { store: context.school.inbox, ai: context.school.ai },
      { teacherId: teacher.teacherId, jobId: input.jobId },
    );
    if (!title) throw new ORPCError("NOT_FOUND", { message: "Photo job not found" });
    return title;
  }),

  /** Reads the photo into a GradeSheetReading plus the verification questions (≤ 60 s). */
  inboxProcess: schoolProcedure
    .input(
      jobIdSchema.extend({
        className: z.string().trim().min(1).max(20),
        assessment: z.string().trim().max(40).nullable(),
      }),
    )
    .handler(async ({ context, input }) => {
      const teacher = await context.caller.requireTeacher();
      const job = await processJob(
        { store: context.school.inbox, ai: context.school.ai, directory: context.school.directory },
        { teacherId: teacher.teacherId, ...input },
      );
      if (!job) throw new ORPCError("NOT_FOUND", { message: "Photo job not found" });
      return job;
    }),

  inboxPhoto: schoolProcedure.input(jobIdSchema).handler(async ({ context, input }) => {
    const teacher = await context.caller.requireTeacher();
    const photo = await jobPhoto({ store: context.school.inbox }, teacher.teacherId, input.jobId);
    if (!photo) throw new ORPCError("NOT_FOUND", { message: "Photo not found" });
    return new File([photo.body], "photo", { type: photo.contentType });
  }),

  /**
   * #278: the small copy the "Foto masuk" card shows before Mulai. It starts no read, and
   * goes with the photo on `inboxAck`.
   */
  inboxThumbnail: schoolProcedure.input(jobIdSchema).handler(async ({ context, input }) => {
    const teacher = await context.caller.requireTeacher();
    const thumbnail = await jobThumbnail(
      { store: context.school.inbox },
      teacher.teacherId,
      input.jobId,
    );
    if (!thumbnail) throw new ORPCError("NOT_FOUND", { message: "Thumbnail not found" });
    return new File([thumbnail.body], "thumbnail", { type: thumbnail.contentType });
  }),

  /** After the teacher saved (or cancelled): delete the photo, its thumbnail and its job. */
  inboxAck: schoolProcedure.input(jobIdSchema).handler(async ({ context, input }) => {
    const teacher = await context.caller.requireTeacher();
    return {
      deleted: await ackJob({ store: context.school.inbox }, teacher.teacherId, input.jobId),
    };
  }),
};
