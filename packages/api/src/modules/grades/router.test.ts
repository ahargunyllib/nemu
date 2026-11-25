import { call } from "@orpc/server";
import { describe, expect, it } from "vite-plus/test";

import { createSchoolContext } from "../../testing/school";
import { createDocumentRepository } from "../documents/repository";
import { inboxRouter } from "../inbox/router";
import { gradesRouter } from "./router";

/** A minimal JPEG (SOI, APP1 EXIF, SOS, EOI) — the offline AI reads any photo as the F1-1 page. */
function jpegWithExif(): File {
  const bytes = new Uint8Array([
    0xff, 0xd8, 0xff, 0xe1, 0x00, 0x08, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00, 0xff, 0xda, 0x00, 0x02,
    0x01, 0xff, 0xd9,
  ]);
  return new File([bytes], "buku-nilai.jpg", { type: "image/jpeg" });
}

describe("F1 through the API (offline AI, seeded SDIT Nusantara)", () => {
  it("photo → 10 questions → answers → 13 remedial with the seeded SOP cited → read-back match", async () => {
    const context = await createSchoolContext();

    const command = await call(
      gradesRouter.gradesParseCommand,
      { utterance: "Nemu, masukkan nilai UTS Matematika 4B" },
      { context },
    );
    expect(command).toEqual({
      status: "ok",
      className: "4B",
      subject: "Matematika",
      assessment: "UTS",
    });

    const queued = await call(inboxRouter.inboxUploadPhoto, { file: jpegWithExif() }, { context });
    expect(queued.status).toBe("queued");
    const stored = [...context.school.inbox.objects.entries()].find(([key]) =>
      key.endsWith("/photo"),
    )![1];
    expect([...new Uint8Array(stored)].includes(0xe1)).toBe(false);

    const job = await call(
      inboxRouter.inboxProcess,
      { jobId: queued.jobId, className: "4B", assessment: "UTS" },
      { context },
    );
    expect(job.status).toBe("ready");
    const questions = job.verification!.questions;
    expect(questions).toHaveLength(10);
    expect(job.verification!.acceptedSentence).toBe("22 nilai lain sudah cocok.");

    const truth: Record<number, string> = { 3: "86", 7: "61", 10: "71", 15: "78" };
    const answers = questions.map((question) => ({
      questionId: question.id,
      answer:
        question.kind === "name"
          ? question.options[0]!.studentId
          : question.kind === "absence"
            ? "Kosongkan"
            : truth[question.line]!,
    }));
    const result = await call(
      gradesRouter.gradesFinalize,
      { reading: job.reading!, answers },
      { context },
    );
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.summary).toEqual({ filled: 31, blank: 1, remedial: 13 });
    expect(result.citations).toEqual({
      "school.kkm": "sop-p2-3-2",
      "school.absence_blank": "sop-p3-4-3",
    });

    const saved = result.entries.map((entry) => ({
      name: entry.name,
      value: entry.value === null ? "" : String(entry.value),
    }));
    const check = await call(
      gradesRouter.gradesReadback,
      { entries: result.entries, saved },
      { context },
    );
    expect(check.sentence).toBe("Sudah saya cek, sama dengan buku.");

    await call(inboxRouter.inboxAck, { jobId: queued.jobId }, { context });
    expect(context.school.inbox.objects.size).toBe(0);
  });

  it("stops with 'needs_source' when the admin deactivates the SOP", async () => {
    const context = await createSchoolContext();
    await createDocumentRepository(context.db).setActive(
      "W-SEKOLAH",
      "sop-penilaian-sdit-nusantara",
      false,
    );
    const result = await call(
      gradesRouter.gradesFinalize,
      {
        reading: {
          source: "excel",
          readable: true,
          issues: [],
          columns: [],
          rows: [],
          unmatchedStudents: [],
          skippedRows: 0,
        },
        answers: [],
      },
      { context },
    );
    expect(result).toMatchObject({
      status: "needs_source",
      missing: ["school.kkm", "school.absence_blank"],
    });
  });

  it("guided mode lines come from the verified entries", async () => {
    const context = await createSchoolContext();
    const entries = [
      {
        studentId: "4b-05",
        name: "Budi Santoso",
        value: 77,
        status: "value" as const,
        remedial: false,
      },
    ];
    await expect(
      call(
        gradesRouter.gradesGuidedLine,
        { entries, studentId: "4b-05", typed: null },
        { context },
      ),
    ).resolves.toEqual({
      sentence: "Ketik 77 untuk Budi.",
      ok: null,
    });
    await expect(
      call(
        gradesRouter.gradesGuidedLine,
        { entries, studentId: "4b-05", typed: "71" },
        { context },
      ),
    ).resolves.toEqual({
      sentence: "Di buku 77, Bu.",
      ok: false,
    });
  });

  it("school procedures refuse other workspaces and accounts without a teacher profile", async () => {
    const travel = await createSchoolContext({
      id: "rina",
      role: "pegawai",
      workspaceId: "W-TRAVEL",
    });
    await expect(
      call(gradesRouter.gradesParseCommand, { utterance: "nilai" }, { context: travel }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    const stranger = await createSchoolContext({
      id: "someone",
      role: "guru",
      workspaceId: "W-SEKOLAH",
    });
    await expect(
      call(gradesRouter.gradesParseCommand, { utterance: "nilai" }, { context: stranger }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "This account has no teacher profile at the school",
    });
  });
});
