import { createFixtureSchoolAi } from "@nemu/ai/school/runtime";
import { describe, expect, it, vi } from "vite-plus/test";

import { createMemoryFileStore } from "../../testing/school";
import { createDemoSchoolDirectory } from "../school/directory";
import { ackJob, enqueuePhoto, listJobs, processJob, teacherForSender } from "./service";

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0x00, 0x02, 0x01, 0xff, 0xd9]);

describe("photo inbox", () => {
  it("a WhatsApp retry of the same message is one job", async () => {
    const store = createMemoryFileStore();
    const first = await enqueuePhoto(
      { store },
      { teacherId: "siti", source: "whatsapp", bytes: JPEG, messageId: "wamid.1" },
    );
    const again = await enqueuePhoto(
      { store },
      { teacherId: "siti", source: "whatsapp", bytes: JPEG, messageId: "wamid.1" },
    );
    expect(
      first.status === "queued" && again.status === "queued" && first.job.jobId === again.job.jobId,
    ).toBe(true);
    expect(await listJobs({ store }, "siti")).toHaveLength(1);
  });

  it("refuses files that aren't images and photos from unregistered numbers", async () => {
    const store = createMemoryFileStore();
    expect(
      await enqueuePhoto(
        { store },
        { teacherId: "siti", source: "upload", bytes: new TextEncoder().encode("%PDF-1.7") },
      ),
    ).toEqual({
      status: "not_an_image",
    });
    const directory = createDemoSchoolDirectory();
    expect(await teacherForSender(directory, "+62 812-0000-0099")).toMatchObject({
      teacherId: "siti",
    });
    expect(await teacherForSender(directory, "081200000099")).toMatchObject({ teacherId: "siti" });
    expect(await teacherForSender(directory, "6289999999999")).toBeNull();
  });

  it("one teacher never sees or processes another teacher's jobs", async () => {
    const store = createMemoryFileStore();
    const queued = await enqueuePhoto(
      { store },
      { teacherId: "siti", source: "upload", bytes: JPEG },
    );
    expect(await listJobs({ store }, "other")).toEqual([]);
    const jobId = queued.status === "queued" ? queued.job.jobId : "";
    const deps = { store, ai: createFixtureSchoolAi(), directory: createDemoSchoolDirectory() };
    expect(
      await processJob(deps, { teacherId: "other", jobId, className: "4B", assessment: "UTS" }),
    ).toBeNull();
    expect(await ackJob({ store }, "other", jobId)).toBe(false);
  });

  it("a job already being read is not read twice; an abandoned one is", async () => {
    const store = createMemoryFileStore();
    const queued = await enqueuePhoto(
      { store },
      { teacherId: "siti", source: "upload", bytes: JPEG, now: 0 },
    );
    const jobId = queued.status === "queued" ? queued.job.jobId : "";
    const ai = createFixtureSchoolAi();
    let release: () => void = () => {};
    const slow = {
      ...ai,
      readGradePhoto: vi.fn(
        (input: Parameters<typeof ai.readGradePhoto>[0]) =>
          new Promise<Awaited<ReturnType<typeof ai.readGradePhoto>>>((resolve) => {
            release = () => resolve(ai.readGradePhoto(input));
          }),
      ),
    };
    const deps = { store, ai: slow, directory: createDemoSchoolDirectory() };

    const running = processJob(deps, {
      teacherId: "siti",
      jobId,
      className: "4B",
      assessment: "UTS",
      now: 1_000,
    });
    await vi.waitFor(() => expect(slow.readGradePhoto).toHaveBeenCalledTimes(1));
    const meanwhile = await processJob(deps, {
      teacherId: "siti",
      jobId,
      className: "4B",
      assessment: "UTS",
      now: 2_000,
    });
    expect(meanwhile?.status).toBe("processing");
    expect(slow.readGradePhoto).toHaveBeenCalledTimes(1);
    release();
    expect((await running)?.status).toBe("ready");
  });

  it("a model failure marks the job failed with a plain message and still surfaces the error", async () => {
    const store = createMemoryFileStore();
    const queued = await enqueuePhoto(
      { store },
      { teacherId: "siti", source: "upload", bytes: JPEG },
    );
    const jobId = queued.status === "queued" ? queued.job.jobId : "";
    const ai = {
      ...createFixtureSchoolAi(),
      readGradePhoto: async () => Promise.reject(new Error("HTTP 502")),
    };
    await expect(
      processJob(
        { store, ai, directory: createDemoSchoolDirectory() },
        { teacherId: "siti", jobId, className: "4B", assessment: null },
      ),
    ).rejects.toThrow("HTTP 502");
    const [job] = await listJobs({ store }, "siti");
    expect(job).toMatchObject({
      status: "failed",
      message: "Foto belum bisa dibaca sekarang. Coba lagi sebentar, ya.",
    });
  });

  it("a class the teacher doesn't teach fails clearly instead of matching against nobody", async () => {
    const store = createMemoryFileStore();
    const queued = await enqueuePhoto(
      { store },
      { teacherId: "siti", source: "upload", bytes: JPEG },
    );
    const jobId = queued.status === "queued" ? queued.job.jobId : "";
    const job = await processJob(
      { store, ai: createFixtureSchoolAi(), directory: createDemoSchoolDirectory() },
      { teacherId: "siti", jobId, className: "6A", assessment: null },
    );
    expect(job).toMatchObject({
      status: "failed",
      message: "Daftar siswa kelas 6A belum ada di Nemu.",
    });
  });
});
