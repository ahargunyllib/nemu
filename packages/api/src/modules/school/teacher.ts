import type { TeacherProfile } from "@nemu/ai/school/profile";
import { ORPCError } from "@orpc/server";

import type { SchoolDirectory } from "./directory";

/** For procedures: the signed-in user's teacher profile, or FORBIDDEN for an account without one. */
export async function requireTeacher(
  directory: SchoolDirectory,
  userId: string,
): Promise<TeacherProfile> {
  const teacher = await directory.teacherForUser(userId);
  if (!teacher) {
    throw new ORPCError("FORBIDDEN", {
      message: "This account has no teacher profile at the school",
    });
  }
  return teacher;
}
