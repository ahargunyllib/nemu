import type { GradeCheck } from "@nemu/ai/school/process-help";
import type { TeacherProfile } from "@nemu/ai/school/profile";

import type { AlurSekolahSiswa } from "../alursekolah/client";
import type { AlurSekolahConnector } from "../alursekolah/connector";

/**
 * F3-13: before Nemu explains why grades don't show, it asks AlurSekolah (through the school's
 * WS-07 key, the same adapter as the F1 read-back) whether the named student has grades saved.
 * A question that names no student has nothing to check ("not_asked": Nemu explains the process
 * as a rule). Not connected or AlurSekolah not answering read as "unknown", so the answer says
 * "kemungkinan" instead of claiming anything.
 */

const ABOUT_GRADES = /\b(nilai|nilainya|rapor|rapornya)\b/iu;

function words(text: string): string[] {
  return text
    .toLocaleLowerCase("id-ID")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .split(" ")
    .filter(Boolean);
}

/** The one student the question names: full name first, then a first name, the teacher's classes first. */
export function studentInQuestion(
  question: string,
  students: readonly AlurSekolahSiswa[],
  teacherClasses: readonly string[],
): AlurSekolahSiswa | null {
  const asked = ` ${words(question).join(" ")} `;
  const scored = students
    .map((student) => {
      const name = words(student.nama);
      const full = asked.includes(` ${name.join(" ")} `);
      const first = name[0] && name[0].length >= 3 && asked.includes(` ${name[0]} `);
      const score = (full ? 4 : first ? 2 : 0) + (teacherClasses.includes(student.kelas) ? 1 : 0);
      return { student, score, named: full || first };
    })
    .filter((item) => item.named)
    .sort((a, b) => b.score - a.score);
  const [best, second] = scored;
  if (!best || (second && second.score === best.score)) return null;
  return best.student;
}

export async function checkSavedGrades(
  connect: AlurSekolahConnector,
  workspaceId: string,
  teacher: Pick<TeacherProfile, "classes">,
  question: string,
): Promise<GradeCheck> {
  if (!ABOUT_GRADES.test(question)) return { status: "not_asked" };
  try {
    const client = await connect(workspaceId);
    const students = await client.siswa();
    const student = studentInQuestion(question, students.data, teacher.classes);
    if (!student) return { status: "not_asked" };
    const saved = await client.nilai({ nis: student.nis, halaman: 1, ukuran: 1 });
    return saved.meta.total > 0
      ? { status: "saved", student: student.nama }
      : { status: "not_saved", student: student.nama };
  } catch (error) {
    // Not connected in WS-07, a refused key, or AlurSekolah down: Nemu says "kemungkinan".
    console.error("Checking saved grades in AlurSekolah failed", error);
    return { status: "unknown" };
  }
}
