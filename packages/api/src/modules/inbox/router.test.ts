import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { call, ORPCError } from "@orpc/server";
import { describe, expect, it } from "vite-plus/test";

import { BU_SITI } from "@nemu/ai/school/fixtures/sdit-nusantara";

import { createSchoolContext, type SchoolTestContext } from "../../testing/school";
import { createDemoSchoolDirectory } from "../school/directory";
import { waBotRouter } from "../wa-bot/router";
import { inboxRouter } from "./router";

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0x00, 0x02, 0x01, 0xff, 0xd9]);
const THUMBNAIL = new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0x00, 0x02, 0x07, 0xff, 0xd9]);
const BU_RINA = { ...BU_SITI, teacherId: "rina", name: "Rina Wulandari", phone: "6281200000098" };

/** Bu Siti's photo with its thumbnail, handed over as `apps/wa-bot` does (internal/nemu/client.go). */
async function handOver(context: SchoolTestContext): Promise<string> {
  const form = new FormData();
  form.set("phone", BU_SITI.phone);
  form.set("messageId", "3EB0THUMB");
  form.set("photo", new File([JPEG], "photo", { type: "image/jpeg" }));
  form.set("thumbnail", new File([THUMBNAIL], "thumbnail", { type: "image/jpeg" }));
  const { response } = await new OpenAPIHandler(waBotRouter).handle(
    new Request("http://nemu.test/api-reference/wa-bot/photos", { method: "POST", body: form }),
    { prefix: "/api-reference", context: { ...context, session: null, internalCaller: "wa-bot" } },
  );
  const body = (await response!.json()) as { status: string; jobId: string };
  expect(body.status).toBe("queued");
  return body.jobId;
}

async function teacherContext(id: string): Promise<SchoolTestContext> {
  const context = await createSchoolContext({ id, role: "guru", workspaceId: "W-SEKOLAH" });
  context.school.directory = createDemoSchoolDirectory([BU_SITI, BU_RINA]);
  return context;
}

describe("inboxThumbnail (#278)", () => {
  it("serves the photo card's thumbnail to its own teacher without reading the photo", async () => {
    const context = await teacherContext("siti");
    const jobId = await handOver(context);

    const thumbnail = await call(inboxRouter.inboxThumbnail, { jobId }, { context });

    expect(thumbnail.type).toBe("image/jpeg");
    expect([...new Uint8Array(await thumbnail.arrayBuffer())]).toEqual([...THUMBNAIL]);
    const [job] = await call(inboxRouter.inboxJobs, undefined, { context });
    expect(job).toMatchObject({ jobId, status: "queued", reading: null });
  });

  it("refuses another teacher, who learns nothing about the photo", async () => {
    const siti = await teacherContext("siti");
    const jobId = await handOver(siti);
    // Bu Rina, a registered teacher of the same school, asks for Bu Siti's job by its id.
    const rina = { ...(await teacherContext("rina")), school: siti.school };

    const error = await call(inboxRouter.inboxThumbnail, { jobId }, { context: rina }).catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(ORPCError);
    expect((error as ORPCError<string, unknown>).code).toBe("NOT_FOUND");
  });

  it("is gone once the teacher saved and the photo was acknowledged (F1-12)", async () => {
    const context = await teacherContext("siti");
    const jobId = await handOver(context);

    await call(inboxRouter.inboxAck, { jobId }, { context });

    await expect(call(inboxRouter.inboxThumbnail, { jobId }, { context })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(context.school.inbox.objects.size).toBe(0);
  });
});
