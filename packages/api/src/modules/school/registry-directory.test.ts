import { describe, expect, it } from "vite-plus/test";

import { createMigratedDb } from "../../testing/d1";
import { teacherForSender } from "../inbox/service";
import { createRegistrySchoolDirectory } from "./registry-directory";
import { createSchoolRepository } from "./repository";
import { createTeacher, deleteTeacher } from "./service";

async function setup() {
  const school = createSchoolRepository(await createMigratedDb());
  return { school, directory: createRegistrySchoolDirectory(school) };
}

describe("SchoolDirectory backed by WS-06", () => {
  it("gives Bu Siti's profile with the school's contacts by role", async () => {
    const { directory } = await setup();

    await expect(directory.teacherForUser("siti")).resolves.toEqual({
      teacherId: "siti",
      name: "Siti Aminah, S.Pd.",
      honorific: "Bu",
      nip: "197003152000032001",
      phone: "6281200001001",
      schoolName: "SDIT Nusantara",
      classes: ["4A", "4B"],
      subjects: ["IPAS", "Bahasa Inggris", "Tahfidz", "Matematika", "Bahasa Indonesia"],
      contacts: {
        kepsek: { name: "Pak Ahmad", role: "kepsek", phone: "6281200001002" },
        operator: { name: "Pak Rizal", role: "operator", phone: "6281200001003" },
        keuangan: { name: "Bu Ratna", role: "keuangan", phone: "6281200001005" },
      },
    });
    await expect(directory.teacherForUser("rizal")).resolves.toBeNull();
  });

  it("finds a teacher by AlurSekolah email (#199) and by WhatsApp sender (#203)", async () => {
    const { directory } = await setup();

    await expect(
      directory.teacherByEmail("W-SEKOLAH", " Siti.Aminah@sditnusantara.sch.id "),
    ).resolves.toMatchObject({ teacherId: "siti" });
    // Another school's install code doesn't reach this school's teachers.
    await expect(
      directory.teacherByEmail("W-TELKO", "siti.aminah@sditnusantara.sch.id"),
    ).resolves.toBeNull();
    await expect(teacherForSender(directory, "+62 812-0000-1004")).resolves.toMatchObject({
      teacherId: "dewi",
    });
    await expect(teacherForSender(directory, "081200001003")).resolves.toBeNull();
  });

  it("serves the rosters of the teacher's own classes only", async () => {
    const { directory } = await setup();

    const roster4b = await directory.roster("siti", "4b");
    expect(roster4b).toHaveLength(32);
    expect(roster4b[0]).toEqual({ studentId: "4b-01", name: "Ahmad Fadli", number: 1 });
    await expect(directory.roster("siti", "4A")).resolves.toHaveLength(10);
    await expect(directory.roster("siti", "5A")).resolves.toEqual([]);
    await expect(directory.gradeConfig("siti")).resolves.toEqual({ kkm: 75 });
  });

  it("recognises a teacher the operator adds, and forgets them once removed", async () => {
    const { school, directory } = await setup();

    await createTeacher({ school }, "W-SEKOLAH", {
      name: "Hendra Gunawan, S.Pd.",
      honorific: "Pak",
      email: "hendra.gunawan@sditnusantara.sch.id",
      phone: "0813-0000-4001",
      classes: ["5A"],
      subjects: ["Matematika"],
    });
    const added = await teacherForSender(directory, "6281300004001");
    expect(added).toMatchObject({ name: "Hendra Gunawan, S.Pd.", honorific: "Pak", nip: "" });
    await expect(directory.roster(added!.teacherId, "5A")).resolves.toHaveLength(20);

    await deleteTeacher({ school }, "W-SEKOLAH", added!.teacherId);
    await expect(teacherForSender(directory, "6281300004001")).resolves.toBeNull();
  });
});
