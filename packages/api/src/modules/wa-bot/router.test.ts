import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { describe, expect, it } from "vite-plus/test";

import { createSchoolContext, type SchoolTestContext } from "../../testing/school";
import { listJobs } from "../inbox/service";
import { waBotRouter } from "./router";

// The wire format `apps/wa-bot` sends (internal/nemu/client.go), through the same handler as the server.
const handler = new OpenAPIHandler(waBotRouter);
const BU_SITI_PHONE = "6281200000099";
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0x00, 0x02, 0x01, 0xff, 0xd9]);

async function post(context: SchoolTestContext, path: string, body: BodyInit) {
  const headers = typeof body === "string" ? { "content-type": "application/json" } : undefined;
  const { response } = await handler.handle(
    new Request(`http://nemu.test/api-reference${path}`, { method: "POST", headers, body }),
    { prefix: "/api-reference", context },
  );
  return { status: response!.status, body: await response!.json() };
}

function photoForm(phone: string, messageId: string, bytes: Uint8Array = JPEG): FormData {
  const form = new FormData();
  form.set("phone", phone);
  form.set("messageId", messageId);
  form.set("photo", new File([bytes.slice()], "photo.jpg", { type: "image/jpeg" }));
  return form;
}

async function botContext(): Promise<SchoolTestContext> {
  return { ...(await createSchoolContext()), session: null, internalCaller: "wa-bot" };
}

describe("wa-bot endpoints", () => {
  it("tell the bot which senders are registered teachers", async () => {
    const context = await botContext();
    expect(await post(context, "/wa-bot/sender", JSON.stringify({ phone: BU_SITI_PHONE }))).toEqual(
      { status: 200, body: { registered: true } },
    );
    expect(
      await post(context, "/wa-bot/sender", JSON.stringify({ phone: "6289999999999" })),
    ).toEqual({ status: 200, body: { registered: false } });
  });

  it("queue a teacher's photo once, however often the bot hands the same message over", async () => {
    const context = await botContext();
    const first = await post(context, "/wa-bot/photos", photoForm(BU_SITI_PHONE, "3EB0ABC"));
    const again = await post(context, "/wa-bot/photos", photoForm(BU_SITI_PHONE, "3EB0ABC"));

    expect(first).toMatchObject({ status: 200, body: { status: "queued" } });
    expect(again.body).toEqual(first.body);
    const jobs = await listJobs({ store: context.school.inbox }, "siti");
    expect(jobs).toEqual([expect.objectContaining({ source: "whatsapp", status: "queued" })]);
  });

  it("queue nothing for an unknown number or a file that isn't a photo", async () => {
    const context = await botContext();
    expect(
      (await post(context, "/wa-bot/photos", photoForm("6289999999999", "3EB0DEF"))).body,
    ).toEqual({ status: "unknown_sender" });
    expect(
      (
        await post(
          context,
          "/wa-bot/photos",
          photoForm(BU_SITI_PHONE, "3EB0GHI", new TextEncoder().encode("%PDF-1.7")),
        )
      ).body,
    ).toEqual({ status: "not_an_image" });
    expect(context.school.inbox.objects.size).toBe(0);
  });

  it("refuse a caller without the shared secret, even a signed-in teacher", async () => {
    const context = await createSchoolContext();
    const sender = await post(context, "/wa-bot/sender", JSON.stringify({ phone: BU_SITI_PHONE }));
    const photo = await post(context, "/wa-bot/photos", photoForm(BU_SITI_PHONE, "3EB0JKL"));

    expect([sender.status, photo.status]).toEqual([401, 401]);
    expect(context.school.inbox.objects.size).toBe(0);
  });
});
