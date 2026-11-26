import type { TeacherProfile } from "@nemu/ai/school/profile";
import type { ExtensionIdentity } from "@nemu/contracts/extension";

import type { SchoolDirectory } from "../school/directory";
import type { SchoolRepository } from "../school/repository";
import { contactCallName } from "../school/service";
import type { ExtensionRepository, InstalledSchool } from "./repository";

/** The school whose install code the extension sent, or null for a missing or unknown code. */
export async function installedSchool(
  extension: Pick<ExtensionRepository, "schoolForInstallCode">,
  code: string | null | undefined,
): Promise<InstalledSchool | null> {
  const trimmed = code?.trim().toUpperCase();
  if (!trimmed) return null;
  return (await extension.schoolForInstallCode(trimmed)) ?? null;
}

export type IdentifyDeps = {
  directory: Pick<SchoolDirectory, "teacherByEmail">;
  school: Pick<SchoolRepository, "listContacts">;
};

/** ID-02: who to ask when the page's account isn't a registered teacher: the school's operator. */
async function unregisteredMessage(
  school: IdentifyDeps["school"],
  workspaceId: string,
): Promise<string> {
  const operator = (await school.listContacts(workspaceId)).find(
    (contact) => contact.role === "operator",
  );
  return `Akun ini belum didaftarkan. Hubungi ${operator ? contactCallName(operator) : "operator sekolah"}.`;
}

/** The WS-06 teacher behind the email on the page, or the sentence to show when there is none. */
export async function identifyTeacher(
  deps: IdentifyDeps,
  school: InstalledSchool,
  email: string,
): Promise<{ teacher: TeacherProfile } | { message: string }> {
  const teacher = await deps.directory.teacherByEmail(school.workspaceId, email);
  if (teacher) return { teacher };
  return { message: await unregisteredMessage(deps.school, school.workspaceId) };
}

export function toIdentity(result: Awaited<ReturnType<typeof identifyTeacher>>): ExtensionIdentity {
  if ("message" in result) return { status: "unregistered", message: result.message };
  return { status: "registered", name: result.teacher.name, honorific: result.teacher.honorific };
}
