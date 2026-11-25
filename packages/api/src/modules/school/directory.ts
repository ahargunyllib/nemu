import { BU_SITI, DEMO_ROSTERS } from "@nemu/ai/school/fixtures/sdit-nusantara";
import type { RosterStudent } from "@nemu/ai/school/names";
import type { TeacherProfile } from "@nemu/ai/school/profile";

/**
 * Who the signed-in teacher is, their classes and rosters, and the school's grade settings (L-02).
 * The fullstack side owns where this comes from (AlurSekolah login or API); the AI modules only
 * read it through this port. The demo directory serves the synthetic SDIT Nusantara.
 */
export type SchoolDirectory = {
  teacherForUser(userId: string): Promise<TeacherProfile | null>;
  teacherByPhone(phone: string): Promise<TeacherProfile | null>;
  roster(teacherId: string, className: string): Promise<RosterStudent[]>;
  /** KKM and other numbers the SOP sets; each is cited through a Rule Source. */
  gradeConfig(teacherId: string): Promise<{ kkm: number }>;
};

export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D+/gu, "");
  return digits.startsWith("0") ? `62${digits.slice(1)}` : digits;
}

export function createDemoSchoolDirectory(
  teachers: readonly TeacherProfile[] = [BU_SITI],
  rosters = DEMO_ROSTERS,
): SchoolDirectory {
  return {
    async teacherForUser(userId) {
      return teachers.find((teacher) => teacher.teacherId === userId) ?? null;
    },
    async teacherByPhone(phone) {
      const wanted = normalizePhone(phone);
      return teachers.find((teacher) => normalizePhone(teacher.phone) === wanted) ?? null;
    },
    async roster(teacherId, className) {
      const teacher = teachers.find((item) => item.teacherId === teacherId);
      if (!teacher?.classes.some((item) => item.toUpperCase() === className.toUpperCase()))
        return [];
      return (
        rosters.find((roster) => roster.className.toUpperCase() === className.toUpperCase())
          ?.students ?? []
      );
    },
    async gradeConfig() {
      return { kkm: 75 };
    },
  };
}
