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

type Unregistered = Extract<ExtensionIdentity, { status: "unregistered" }>;

/**
 * ID-02: the sentence for an account that isn't a registered teacher, and the school's operator,
 * whom the extension offers a ready WhatsApp message to (F2-05 hand-off).
 */
async function unregistered(
  school: IdentifyDeps["school"],
  workspaceId: string,
  email: string,
): Promise<Omit<Unregistered, "status">> {
  const operator = (await school.listContacts(workspaceId)).find(
    (contact) => contact.role === "operator",
  );
  if (!operator) {
    return {
      message: "Akun Ibu belum didaftarkan di Nemu. Minta operator sekolah mendaftarkannya.",
      email,
      operator: null,
    };
  }
  return {
    message: "Akun Ibu belum didaftarkan di Nemu.",
    email,
    operator: { name: contactCallName(operator), phone: operator.phone },
  };
}

/** The WS-06 teacher behind the email on the page, or why Nemu can't help that account yet. */
export async function identifyTeacher(
  deps: IdentifyDeps,
  school: InstalledSchool,
  email: string,
): Promise<
  { teacher: TeacherProfile; operator: boolean } | { unregistered: Omit<Unregistered, "status"> }
> {
  const teacher = await deps.directory.teacherByEmail(school.workspaceId, email);
  if (teacher) {
    const contacts = await deps.school.listContacts(school.workspaceId);
    const operator = contacts.some(
      (contact) => contact.role === "operator" && contact.phone === teacher.phone,
    );
    return { teacher, operator };
  }
  return { unregistered: await unregistered(deps.school, school.workspaceId, email) };
}

export function toIdentity(result: Awaited<ReturnType<typeof identifyTeacher>>): ExtensionIdentity {
  if ("unregistered" in result) return { status: "unregistered", ...result.unregistered };
  return {
    status: "registered",
    name: result.teacher.name,
    honorific: result.teacher.honorific,
    ...(result.operator ? { operator: true as const } : {}),
  };
}
