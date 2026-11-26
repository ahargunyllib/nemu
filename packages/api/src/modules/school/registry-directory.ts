import type { TeacherProfile } from "@nemu/ai/school/profile";

import { normalizePhone, type SchoolDirectory } from "./directory";
import type { SchoolRepository, TeacherRecord } from "./repository";
import { toTeacherProfile } from "./service";

/** The KKM SDIT Nusantara's profil-sekolah.json sets; the SOP chunk citing it is the Rule Source. */
const KKM = 75;

/**
 * The `SchoolDirectory` port backed by WS-06: the teachers and contacts the operator registers in
 * the Admin Workspace, and the class rosters seeded from the school's daftar siswa.
 */
export function createRegistrySchoolDirectory(school: SchoolRepository): SchoolDirectory {
  async function profile(teacher: TeacherRecord | undefined): Promise<TeacherProfile | null> {
    if (!teacher) return null;
    const [contacts, schoolName] = await Promise.all([
      school.listContacts(teacher.workspaceId),
      school.schoolName(teacher.workspaceId),
    ]);
    return toTeacherProfile(teacher, contacts, schoolName ?? teacher.workspaceId);
  }

  return {
    async teacherForUser(userId) {
      return profile(await school.findTeacher({ userId }));
    },
    async teacherByPhone(phone) {
      return profile(await school.findTeacher({ phone: normalizePhone(phone) }));
    },
    async teacherByEmail(workspaceId, email) {
      const teacher = await school.findTeacher({ email: email.trim().toLowerCase() });
      return profile(teacher?.workspaceId === workspaceId ? teacher : undefined);
    },
    async roster(teacherId, className) {
      const teacher = await school.findTeacher({ id: teacherId });
      if (!teacher?.classes.some((item) => item.toUpperCase() === className.toUpperCase())) {
        return [];
      }
      const students = await school.listStudents(teacher.workspaceId, className);
      return students.map(({ id, name, number }) => ({ studentId: id, name, number }));
    },
    async gradeConfig() {
      return { kkm: KKM };
    },
  };
}
