import { call } from "@orpc/server";
import { describe, expect, it } from "vite-plus/test";

import { F1_ROSTER } from "@nemu/ai/school/fixtures/f1-photo";
import { BU_SITI, CLASS_4B } from "@nemu/ai/school/fixtures/sdit-nusantara";
import type { GradeEntry } from "@nemu/contracts/school";

import { type FakeNilai, createFakeAlurSekolah } from "../../testing/alursekolah";
import { connectAlurSekolah, createSchoolContext } from "../../testing/school";
import { createDocumentRepository } from "../documents/repository";
import { createDemoSchoolDirectory } from "../school/directory";
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
  it("photo → 10 questions → answers → 13 remedial with the official SOP cited → read-back match", async () => {
    const context = await createSchoolContext();
    // The official F1-1 photo is of 01_profil-sekolah's 4B, as WS-06 seeds it.
    context.school.directory = createDemoSchoolDirectory(
      [BU_SITI],
      [{ className: "4B", students: F1_ROSTER }],
    );

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

    const truth: Record<number, string> = { 7: "85", 10: "71", 20: "83", 28: "94" };
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
      "school.kkm": "sop-penilaian-sdit-nusantara-page-2-pasal-3.2",
      "school.absence_blank": "sop-penilaian-sdit-nusantara-page-3-pasal-4.3",
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

describe("F1-10 read-back from AlurSekolah API v1", () => {
  const students = CLASS_4B.slice(0, 4).map((student, index) => ({
    ...student,
    nis: String(2001 + index),
  }));
  const entries: GradeEntry[] = students.map((student, index) => ({
    studentId: student.studentId,
    name: student.name,
    value: index === 3 ? null : 70 + index,
    status: index === 3 ? "S" : "value",
    remedial: false,
  }));
  const nilai = (index: number, skor: number, extra: Partial<FakeNilai> = {}): FakeNilai => ({
    id: index + 1,
    nis: students[index]!.nis,
    nama_siswa: students[index]!.name,
    kelas: "4B",
    semester: "2026/2027 Ganjil",
    mapel: "Matematika",
    jenis: "UTS",
    skor,
    tanggal: "2026-12-01",
    ...extra,
  });
  const siswa = students.map((student) => ({ nis: student.nis, nama: student.name, kelas: "4B" }));
  const readback = (
    context: Awaited<ReturnType<typeof createSchoolContext>>,
    input: Partial<{ className: string; assessment: string }> = {},
  ) =>
    call(
      gradesRouter.gradesReadbackAlurSekolah,
      { entries, className: "4B", subject: "Matematika", assessment: "UTS", ...input },
      { context },
    );

  it("reads /nilai for the class, subject and assessment and finds it matches the book", async () => {
    // The sick student (S) has no stored grade: AlurSekolah leaves empty cells out of /nilai.
    const fake = createFakeAlurSekolah({
      siswa,
      nilai: [nilai(0, 70), nilai(1, 71), nilai(2, 72), nilai(0, 99, { mapel: "IPA" })],
    });
    const context = await createSchoolContext(undefined, undefined, fake);
    await connectAlurSekolah(context);

    await expect(readback(context, { className: "4b" })).resolves.toEqual({
      match: true,
      mismatches: [],
      sentence: "Sudah saya cek, sama dengan buku.",
    });
    const asked = fake.requests.map(({ url }) => url.pathname + decodeURIComponent(url.search));
    expect(asked).toContain("/api/v1/nilai?kelas=4B&mapel=Matematika&jenis=UTS");
    expect(asked).toContain("/api/v1/siswa?kelas=4B");
  });

  it("names a wrong or missing grade, and takes a student's newest row", async () => {
    const fake = createFakeAlurSekolah({
      siswa,
      nilai: [
        nilai(0, 70),
        nilai(1, 17),
        nilai(2, 50, { tanggal: "2026-11-30" }),
        { ...nilai(2, 72), id: 9 },
      ],
    });
    const context = await createSchoolContext(undefined, undefined, fake);
    await connectAlurSekolah(context);
    const result = await readback(context);
    expect(result.match).toBe(false);
    expect(result.mismatches).toEqual([
      { studentId: students[1]!.studentId, name: students[1]!.name, expected: "71", saved: "17" },
    ]);

    fake.nilai.splice(1, 1);
    expect((await readback(context)).mismatches).toEqual([
      {
        studentId: students[1]!.studentId,
        name: students[1]!.name,
        expected: "71",
        saved: "kosong",
      },
    ]);
  });

  it("finds UH grades stored under AlurSekolah's Harian", async () => {
    const fake = createFakeAlurSekolah({
      siswa,
      nilai: [0, 1, 2].map((index) => nilai(index, 70 + index, { jenis: "Harian" })),
    });
    const context = await createSchoolContext(undefined, undefined, fake);
    await connectAlurSekolah(context);
    await expect(readback(context, { assessment: "UH 1" })).resolves.toMatchObject({ match: true });
  });

  it("explains what is missing: no WS-07 settings, a refused key, a class that isn't hers", async () => {
    const context = await createSchoolContext();
    await expect(readback(context)).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: expect.stringMatching(/AlurSekolah belum dihubungkan/u),
    });

    await connectAlurSekolah(context, { apiKey: "as_dicabut_0000" });
    await expect(readback(context)).rejects.toMatchObject({
      code: "BAD_GATEWAY",
      message: expect.stringMatching(/HTTP 401/u),
    });

    await expect(readback(context, { className: "5A" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});
