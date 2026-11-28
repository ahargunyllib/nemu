import { call } from "@orpc/server";
import { describe, expect, it } from "vite-plus/test";

import { createSchoolContext } from "../../testing/school";
import { schoolRouter } from "./router";

const OPERATOR = { id: "rizal", role: "operator", workspaceId: "W-SEKOLAH" };
const ADMIN_JAVAN = { id: "javan", role: "admin", workspaceId: "W-SEKOLAH" };

const BU_RINA = {
  name: "Rina Wulandari, S.Pd.",
  honorific: "Bu" as const,
  email: "Rina.Wulandari@SDITNusantara.sch.id",
  phone: "0812-0000-2001",
  classes: ["6a"],
  subjects: ["IPAS", "Matematika"],
};

describe("WS-06 teachers and contacts", () => {
  it("shows the operator the school's seeded teachers and contacts", async () => {
    const context = await createSchoolContext(OPERATOR);

    const teachers = await call(schoolRouter.listTeachers, undefined, { context });
    expect(
      teachers.map(({ name, email, phone, classes }) => ({ name, email, phone, classes })),
    ).toEqual([
      {
        name: "Dewi Lestari, S.Pd.",
        email: "dewi.lestari@sditnusantara.sch.id",
        phone: "6281200001004",
        classes: ["5A"],
      },
      {
        name: "Siti Aminah, S.Pd.",
        email: "siti.aminah@sditnusantara.sch.id",
        phone: "6281200001001",
        classes: ["4A", "4B"],
      },
    ]);

    const contacts = await call(schoolRouter.listContacts, undefined, { context });
    expect(contacts.map(({ role, name }) => [role, name])).toEqual([
      ["operator", "Rizal Pratama"],
      ["kepsek", "Ahmad Fauzi, M.Pd."],
      ["keuangan", "Ratna Sari"],
    ]);
  });

  it("adds, edits and removes a teacher, normalising the email and the WhatsApp number", async () => {
    const context = await createSchoolContext(OPERATOR);

    await call(schoolRouter.createTeacher, BU_RINA, { context });
    const added = (await call(schoolRouter.listTeachers, undefined, { context })).find(
      (teacher) => teacher.name === BU_RINA.name,
    );
    expect(added).toMatchObject({
      email: "rina.wulandari@sditnusantara.sch.id",
      phone: "6281200002001",
      classes: ["6A"],
    });

    await call(
      schoolRouter.updateTeacher,
      { ...BU_RINA, id: added!.id, classes: ["6A", "6B"], phone: "+62 812-0000-2002" },
      { context },
    );
    const edited = (await call(schoolRouter.listTeachers, undefined, { context })).find(
      (teacher) => teacher.id === added!.id,
    );
    expect(edited).toMatchObject({ classes: ["6A", "6B"], phone: "6281200002002" });

    await call(schoolRouter.deleteTeacher, { id: added!.id }, { context });
    const remaining = await call(schoolRouter.listTeachers, undefined, { context });
    expect(remaining.map((teacher) => teacher.id)).toEqual(["dewi", "siti"]);
  });

  it("refuses a WhatsApp number or email another teacher already uses", async () => {
    const context = await createSchoolContext(OPERATOR);

    await expect(
      call(schoolRouter.createTeacher, { ...BU_RINA, phone: "081200001001" }, { context }),
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message: "Nomor WhatsApp ini sudah dipakai guru lain",
    });
    await expect(
      call(
        schoolRouter.updateTeacher,
        { ...BU_RINA, id: "dewi", email: "SITI.AMINAH@sditnusantara.sch.id" },
        { context },
      ),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("saves one contact per role and removes it", async () => {
    const context = await createSchoolContext(OPERATOR);

    await call(
      schoolRouter.saveContact,
      { role: "keuangan", name: "Lina Marlina", honorific: "Bu", phone: "0812 0000 3001" },
      { context },
    );
    await call(schoolRouter.deleteContact, { role: "kepsek" }, { context });

    const contacts = await call(schoolRouter.listContacts, undefined, { context });
    expect(contacts.map(({ role, name, phone }) => [role, name, phone])).toEqual([
      ["operator", "Rizal Pratama", "6281200001003"],
      ["keuangan", "Lina Marlina", "6281200003001"],
    ]);
  });
});

describe("workspace roles", () => {
  it("keeps a teacher out of WS-06", async () => {
    const context = await createSchoolContext();
    await expect(call(schoolRouter.listTeachers, undefined, { context })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("keeps an operator to its school's pages: no school list", async () => {
    const context = await createSchoolContext(OPERATOR);
    await expect(call(schoolRouter.listSchools, undefined, { context })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("names the operator's own school, and keeps a teacher out of it", async () => {
    await expect(
      call(schoolRouter.currentSchool, undefined, { context: await createSchoolContext(OPERATOR) }),
    ).resolves.toEqual({ id: "W-SEKOLAH", name: "SDIT Nusantara" });
    await expect(
      call(schoolRouter.currentSchool, undefined, { context: await createSchoolContext() }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("shows Admin Javan the one-row school list and WS-06", async () => {
    const context = await createSchoolContext(ADMIN_JAVAN);
    await expect(call(schoolRouter.listSchools, undefined, { context })).resolves.toEqual([
      { id: "W-SEKOLAH", name: "SDIT Nusantara", teachers: 2, contacts: 3 },
    ]);
    await expect(call(schoolRouter.listTeachers, undefined, { context })).resolves.toHaveLength(2);
  });
});
