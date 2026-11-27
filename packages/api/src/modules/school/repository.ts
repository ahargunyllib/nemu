import { and, asc, type Database, count, eq } from "@nemu/db";
import { schoolContact, schoolStudent, schoolTeacher } from "@nemu/db/schema/school";
import { workspace } from "@nemu/db/schema/workspace";

export type TeacherRecord = typeof schoolTeacher.$inferSelect;
export type NewTeacherRecord = typeof schoolTeacher.$inferInsert;
export type ContactRecord = typeof schoolContact.$inferSelect;
export type ContactRole = ContactRecord["role"];
export type StudentRecord = typeof schoolStudent.$inferSelect;
export type SchoolRecord = { id: string; name: string; teachers: number; contacts: number };

export type TeacherChanges = Omit<
  NewTeacherRecord,
  "id" | "workspaceId" | "createdAt" | "updatedAt"
>;

/** WS-01 and WS-06 storage: schools (Knowledge Workspaces of the school domain), teachers, contacts, rosters. */
export type SchoolRepository = {
  listSchools(): Promise<SchoolRecord[]>;
  schoolName(workspaceId: string): Promise<string | undefined>;
  listTeachers(workspaceId: string): Promise<TeacherRecord[]>;
  findTeacher(
    by: { id: string } | { userId: string } | { phone: string } | { email: string },
  ): Promise<TeacherRecord | undefined>;
  insertTeacher(record: NewTeacherRecord): Promise<void>;
  updateTeacher(workspaceId: string, id: string, changes: TeacherChanges): Promise<boolean>;
  deleteTeacher(workspaceId: string, id: string): Promise<boolean>;
  listContacts(workspaceId: string): Promise<ContactRecord[]>;
  upsertContact(record: Omit<ContactRecord, "id" | "createdAt" | "updatedAt">): Promise<void>;
  deleteContact(workspaceId: string, role: ContactRole): Promise<boolean>;
  listStudents(workspaceId: string, className: string): Promise<StudentRecord[]>;
};

function teacherWhere(by: Parameters<SchoolRepository["findTeacher"]>[0]) {
  if ("id" in by) return eq(schoolTeacher.id, by.id);
  if ("userId" in by) return eq(schoolTeacher.userId, by.userId);
  if ("phone" in by) return eq(schoolTeacher.phone, by.phone);
  return eq(schoolTeacher.email, by.email);
}

export function createSchoolRepository(db: Database): SchoolRepository {
  return {
    async listSchools() {
      const [schools, teachers, contacts] = await Promise.all([
        db
          .select({ id: workspace.id, name: workspace.name })
          .from(workspace)
          .where(eq(workspace.domain, "school"))
          .orderBy(asc(workspace.name)),
        db
          .select({ workspaceId: schoolTeacher.workspaceId, total: count() })
          .from(schoolTeacher)
          .groupBy(schoolTeacher.workspaceId),
        db
          .select({ workspaceId: schoolContact.workspaceId, total: count() })
          .from(schoolContact)
          .groupBy(schoolContact.workspaceId),
      ]);
      const totals = (rows: { workspaceId: string; total: number }[], id: string) =>
        rows.find((row) => row.workspaceId === id)?.total ?? 0;
      return schools.map((school) => ({
        ...school,
        teachers: totals(teachers, school.id),
        contacts: totals(contacts, school.id),
      }));
    },
    async schoolName(workspaceId) {
      const [record] = await db
        .select({ name: workspace.name })
        .from(workspace)
        .where(eq(workspace.id, workspaceId))
        .limit(1);
      return record?.name;
    },
    listTeachers(workspaceId) {
      return db
        .select()
        .from(schoolTeacher)
        .where(eq(schoolTeacher.workspaceId, workspaceId))
        .orderBy(asc(schoolTeacher.name));
    },
    async findTeacher(by) {
      const [record] = await db.select().from(schoolTeacher).where(teacherWhere(by)).limit(1);
      return record;
    },
    async insertTeacher(record) {
      await db.insert(schoolTeacher).values(record);
    },
    async updateTeacher(workspaceId, id, changes) {
      const updated = await db
        .update(schoolTeacher)
        .set(changes)
        .where(and(eq(schoolTeacher.workspaceId, workspaceId), eq(schoolTeacher.id, id)))
        .returning({ id: schoolTeacher.id });
      return updated.length > 0;
    },
    async deleteTeacher(workspaceId, id) {
      const deleted = await db
        .delete(schoolTeacher)
        .where(and(eq(schoolTeacher.workspaceId, workspaceId), eq(schoolTeacher.id, id)))
        .returning({ id: schoolTeacher.id });
      return deleted.length > 0;
    },
    listContacts(workspaceId) {
      return db.select().from(schoolContact).where(eq(schoolContact.workspaceId, workspaceId));
    },
    async upsertContact(record) {
      await db
        .insert(schoolContact)
        .values({ ...record, id: `${record.workspaceId}-${record.role}` })
        .onConflictDoUpdate({
          target: [schoolContact.workspaceId, schoolContact.role],
          set: {
            name: record.name,
            honorific: record.honorific,
            phone: record.phone,
            updatedAt: new Date(),
          },
        });
    },
    async deleteContact(workspaceId, role) {
      const deleted = await db
        .delete(schoolContact)
        .where(and(eq(schoolContact.workspaceId, workspaceId), eq(schoolContact.role, role)))
        .returning({ id: schoolContact.id });
      return deleted.length > 0;
    },
    listStudents(workspaceId, className) {
      return db
        .select()
        .from(schoolStudent)
        .where(
          and(
            eq(schoolStudent.workspaceId, workspaceId),
            eq(schoolStudent.className, className.toUpperCase()),
          ),
        )
        .orderBy(asc(schoolStudent.number));
    },
  };
}
